// GST Service for Masters India GSP Integration (Mocked)
const axios = require('axios');
const db = require('../db');
const buildInvoiceJSON = require('../utils/buildInvoiceJSON');
require('dotenv').config();
const redis = require('../utils/redisClient');

const TOKEN_KEY = 'gst_token';
const TOKEN_TTL = 14 * 60; // 14 minutes

const GSP_BASE_URL = process.env.GSP_BASE_URL;
const GSP_USERNAME = process.env.GSP_USERNAME;
const GSP_PASSWORD = process.env.GSP_PASSWORD;

const getAuthToken = async () => {
  // 1. Check Redis first
  const cachedToken = await redis.get(TOKEN_KEY);
  if (cachedToken) return cachedToken;

  // 2. If not cached, fetch new token
  const response = await axios.post(
    `${GSP_BASE_URL}/api/v1/token-auth/`,
    {
      username: GSP_USERNAME,
      password: GSP_PASSWORD,
    }
  );
  const newToken = response.data.token;
  if (!newToken) throw new Error('Token fetch failed');

  // 3. Store in Redis
  await redis.set(TOKEN_KEY, newToken, 'EX', TOKEN_TTL);

  return newToken;
};

// Updated generateIRN
const generateIRN = async (invoice_id) => {
  // Fetch invoice, customer, distributor, order_items
  const invoiceResult = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
  const invoice = invoiceResult.rows[0] || null;
  if (!invoice) throw new Error('Invoice not found');
  const customerResult = await db.query('SELECT * FROM customers WHERE customer_id = $1', [invoice.customer_id]);
  const customer = customerResult.rows[0] || null;
  const distributorResult = await db.query('SELECT * FROM distributors WHERE distributor_id = $1', [invoice.distributor_id]);
  const distributor = distributorResult.rows[0] || null;
  const orderItemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [invoice.order_id]);
  const orderItems = orderItemsResult.rows;

  // Build NIC v1.1 JSON
  const invoicePayload = await buildInvoiceJSON(invoice, customer, distributor, orderItems);

  // Get auth token
  const token = await getAuthToken();

  try {
    // Call Masters India e-invoice generate endpoint
    const response = await axios.post(
      `${GSP_BASE_URL}/api/v1/einvoice/generate`,
      invoicePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = response.data;
    // Update invoice with IRN details
    await db.query(
      `UPDATE invoices SET irn = $1, ack_no = $2, ack_date = $3, einvoice_status = 'SUCCESS', status = 'issued', gst_invoice_json = $4, signed_qr_code = $5 WHERE invoice_id = $6`,
      [
        data.irn,
        data.ack_no,
        data.ack_date,
        JSON.stringify(data),
        data.signed_qr_code || null,
        invoice_id,
      ]
    );
    return { success: true, irn: data.irn, ack_no: data.ack_no, ack_date: data.ack_date, response: data };
  } catch (error) {
    // On failure, update status and store error
    await db.query(
      `UPDATE invoices SET einvoice_status = 'FAILED', gst_error_message = $1 WHERE invoice_id = $2`,
      [error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error', invoice_id]
    );
    return { success: false, error: error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error' };
  }
};

// Generate Credit Note IRN
const generateCreditNoteIRN = async (invoice_id) => {
  // Fetch the credit note invoice
  const invoiceResult = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
  const invoice = invoiceResult.rows[0] || null;
  if (!invoice) throw new Error('Invoice not found');
  // Fetch the original invoice (the one being credited)
  const originalInvoiceResult = await db.query('SELECT * FROM invoices WHERE credit_note_id = $1', [invoice_id]);
  const originalInvoice = originalInvoiceResult.rows[0] || null;
  if (!originalInvoice) throw new Error('Original invoice not found for credit note');
  const customerResult = await db.query('SELECT * FROM customers WHERE customer_id = $1', [invoice.customer_id]);
  const customer = customerResult.rows[0] || null;
  const distributorResult = await db.query('SELECT * FROM distributors WHERE distributor_id = $1', [invoice.distributor_id]);
  const distributor = distributorResult.rows[0] || null;
  const orderItemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [invoice.order_id]);
  const orderItems = orderItemsResult.rows;

  // Build JSON payload for credit note
  const invoicePayload = await buildInvoiceJSON(
    { ...invoice, doc_type: 'CRN', irn: originalInvoice.irn },
    customer,
    distributor,
    orderItems.map(item => ({ ...item, quantity: -Math.abs(item.quantity) })) // negative quantities for credit note
  );
  invoicePayload.document_details.document_type = 'CRN';
  invoicePayload.Irn = originalInvoice.irn;

  // Get auth token
  const token = await getAuthToken();

  try {
    // Call Masters India e-invoice generate endpoint
    const response = await axios.post(
      `${GSP_BASE_URL}/api/v1/einvoice/generate`,
      invoicePayload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = response.data;
    // Update invoice with IRN details
    await db.query(
      `UPDATE invoices SET irn = $1, ack_no = $2, ack_date = $3, einvoice_status = 'CREDIT_NOTE_SUCCESS', gst_invoice_json = $4, signed_qr_code = $5 WHERE invoice_id = $6`,
      [
        data.irn,
        data.ack_no,
        data.ack_date,
        JSON.stringify(data),
        data.signed_qr_code || null,
        invoice_id,
      ]
    );
    return { success: true, irn: data.irn, ack_no: data.ack_no, ack_date: data.ack_date, response: data };
  } catch (error) {
    await db.query(
      `UPDATE invoices SET einvoice_status = 'FAILED', gst_error_message = $1 WHERE invoice_id = $2`,
      [error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error', invoice_id]
    );
    return { success: false, error: error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error' };
  }
};

// Cancel IRN
const cancelIRN = async (invoice_id, reason) => {
  // Fetch the invoice
  const invoiceResult = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
  const invoice = invoiceResult.rows[0] || null;
  if (!invoice) throw new Error('Invoice not found');
  if (!invoice.irn) throw new Error('No IRN found for this invoice');

  // Get auth token
  const token = await getAuthToken();

  const payload = {
    Irn: invoice.irn,
    CnlRem: reason || 'User requested cancellation',
    CnlDt: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  };

  try {
    const response = await axios.post(
      `${GSP_BASE_URL}/api/v1/einvoice/cancel`,
      payload,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = response.data;
    await db.query(
      `UPDATE invoices SET einvoice_status = 'CANCELLED', status = 'cancelled', gst_invoice_json = $1 WHERE invoice_id = $2`,
      [JSON.stringify(data), invoice_id]
    );
    return { success: true, response: data };
  } catch (error) {
    await db.query(
      `UPDATE invoices SET gst_error_message = $1 WHERE invoice_id = $2`,
      [error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error', invoice_id]
    );
    return { success: false, error: error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error' };
  }
};

// Fetch GST Invoice Metadata
const getInvoiceDetails = async (irn) => {
  if (!irn) throw new Error('IRN is required');
  const token = await getAuthToken();
  try {
    const response = await axios.get(
      `${GSP_BASE_URL}/api/v1/einvoice/get-irn-details/${irn}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    const data = response.data;
    // Optionally update the invoice in DB if you have invoice_id
    // await db.none(`UPDATE invoices SET gst_invoice_json = $1 WHERE irn = $2`, [JSON.stringify(data), irn]);
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message || (error.response && error.response.data && error.response.data.message) || 'Unknown error' };
  }
};

module.exports = {
  getAuthToken,
  generateIRN,
  generateCreditNoteIRN,
  cancelIRN,
  getInvoiceDetails,
};
// Manual test: Call generateIRN with a valid invoice_id and check DB update and console output. 
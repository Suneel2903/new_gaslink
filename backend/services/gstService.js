// GST Service for Masters India GSP Integration (Mocked)
const axios = require('axios');
const db = require('../db');
const buildInvoiceJSON = require('../utils/buildInvoiceJSON');
require('dotenv').config();
const redis = require('../utils/redisClient');
const { generateInvoicePayload } = require('./generateInvoicePayload');

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
  let response;
  try {
    response = await axios.post(
      `${GSP_BASE_URL}/api/v1/token-auth/`,
      {
        username: GSP_USERNAME,
        password: GSP_PASSWORD,
      }
    );
  } catch (err) {
    console.error('❌ GST Token fetch failed:', err.response?.data || err.message);
    throw new Error('GST Token fetch failed: ' + (err.response?.data?.message || err.message));
  }
  const newToken = response.data.token;
  if (!newToken) throw new Error('Token fetch failed');

  // 3. Store in Redis
  await redis.set(TOKEN_KEY, newToken, 'EX', TOKEN_TTL);

  return newToken;
};

// Patch: Use dummy GSTINs for seller and buyer if in sandbox mode
const isSandbox = GSP_BASE_URL && GSP_BASE_URL.includes('sandb-api.mastersindia.co');

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

  // Log resolved GSTINs before building payload
  console.log('Resolved GSTINs', {
    user_gstin: distributor?.gstin,
    seller_gstin: distributor?.gstin,
    buyer_gstin: customer?.gstin
  });

  // Build NIC v1.1 JSON
  const invoicePayload = await generateInvoicePayload(invoice_id);

  // Payload validation before submission
  const requiredFields = [
    invoicePayload.document_details?.document_number,
    invoicePayload.seller_details?.location,
    invoicePayload.seller_details?.pincode,
    invoicePayload.buyer_details?.location,
    invoicePayload.buyer_details?.pincode,
    invoicePayload.buyer_details?.place_of_supply,
    invoicePayload.item_list[0]?.item_serial_number,
    invoicePayload.item_list[0]?.is_service,
  ];
  if (requiredFields.includes(undefined) || requiredFields.includes(null)) {
    throw new Error("Mandatory fields missing in GST payload. Please update distributor/customer details.");
  }

  // Log the FINAL payload and GSTINs before sending to Masters India
  console.log('Masters India IRN FINAL payload:', JSON.stringify(invoicePayload, null, 2));
  console.log('Payload GSTINs:', {
    seller: invoicePayload.seller_details?.gstin,
    buyer: invoicePayload.buyer_details?.gstin
  });

  // Patch: Use dummy GSTINs for sandbox
  if (isSandbox) {
    if (invoicePayload.seller_details) invoicePayload.seller_details.gstin = '05AAAPG7885R002';
    if (invoicePayload.buyer_details) invoicePayload.buyer_details.gstin = '09AAAPG7885R002';
  }

  // FINAL ENFORCEMENT for Masters India sandbox (right before sending)
  if (process.env.IS_SANDBOX === 'true') {
    invoicePayload.seller_details.gstin = '09AAAPG7885R002';
    invoicePayload.seller_details.state_code = '09';
    invoicePayload.buyer_details.gstin = '05AAAPG7885R002';
    invoicePayload.buyer_details.state_code = '05';
    invoicePayload.user_gstin = '09AAAPG7885R002';
  }
  // Log the FINAL payload sent to Masters India (after override)
  console.log('FINAL payload sent to Masters India:', JSON.stringify(invoicePayload, null, 2));

  // Get auth token
  const token = await getAuthToken();
  console.log('GST Token (first 10 chars):', token?.slice(0, 10));
  const requestUrl = `${GSP_BASE_URL}/api/v1/einvoice/`;
  console.log('Masters India IRN request URL:', requestUrl);
  // Remove the masked GSTIN log to avoid confusion
  // Only log the FINAL payload sent to Masters India (unmasked)
  console.log('FINAL payload sent to Masters India:', JSON.stringify(invoicePayload, null, 2));

  // Extra debug logging: show the exact payload and GSTINs POSTed to Masters India
  console.log('=== FINAL PAYLOAD TO MASTERS INDIA ===');
  console.log(JSON.stringify(invoicePayload, null, 2));
  console.log('Seller GSTIN:', invoicePayload.seller_details?.gstin, 'Buyer GSTIN:', invoicePayload.buyer_details?.gstin);

  // Do NOT mask GSTINs in the actual payload sent to the API
  // The following Axios call must use the original, unmasked invoicePayload
  try {
    const headers = {
      Authorization: `JWT ${token}`,
      'Content-Type': 'application/json',
    };
    console.log('Masters India IRN request headers:', { ...headers, Authorization: 'JWT ...' });
    // Log the FINAL payload sent to Masters India
    const response = await axios.post(
      requestUrl,
      invoicePayload, // <-- always unmasked
      {
        headers,
      }
    );
    const data = response.data;
    let irn, ackNo, ackDate, signedQR, status;

    if (data.results && data.results.message) {
      irn = data.results.message.Irn || data.results.message.irn;
      ackNo = data.results.message.AckNo || data.results.message.ack_no;
      ackDate = data.results.message.AckDt || data.results.message.ack_date;
      signedQR = data.results.message.SignedQRCode || data.results.message.signed_qr_code;
      status = data.results.status || data.status;
    } else {
      irn = data.irn || data.Irn;
      ackNo = data.ack_no || data.AckNo;
      ackDate = data.ack_date || data.AckDate;
      signedQR = data.signed_qr_code || data.SignedQRCode;
      status = data.status;
    }

    // Only mark as success if IRN is present and status is 'Success'
    if (irn && status && status.toLowerCase() === 'success') {
      await db.query(
        `UPDATE invoices SET irn = $1, ack_no = $2, ack_date = $3, einvoice_status = 'SUCCESS', status = 'issued', gst_invoice_json = $4, signed_qr_code = $5 WHERE invoice_id = $6`,
        [
          irn,
          ackNo,
          ackDate,
          JSON.stringify(data),
          signedQR || null,
          invoice_id,
        ]
      );
      return {
        success: true,
        irn,
        ack_no: ackNo,
        ack_date: ackDate,
        response: data,
      };
    } else {
      await db.query(
        `UPDATE invoices SET einvoice_status = 'FAILED', gst_invoice_json = $1, gst_error_message = $2 WHERE invoice_id = $3`,
        [JSON.stringify(data), 'IRN generation failed', invoice_id]
      );
      return {
        success: false,
        irn: null,
        ack_no: null,
        ack_date: null,
        response: data,
      };
    }
  } catch (error) {
    // Log full error response from Masters India
    if (error.response) {
      console.error('Masters India IRN API error response:', error.response.status, error.response.data);
    } else {
      console.error('Masters India IRN API error:', error.message);
    }
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
      `${GSP_BASE_URL}/api/v1/einvoice/`,
      invoicePayload,
      {
        headers: {
          Authorization: `JWT ${token}`,
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
          Authorization: `JWT ${token}`,
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
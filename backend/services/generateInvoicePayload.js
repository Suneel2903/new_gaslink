/**
 * SANDBOX TESTING MODE ENABLED
 * Using dummy credentials and GSTINs for testing on sandbox.einvoice1 portal
 * TODO: DISABLE BEFORE MOVING TO PRODUCTION
 */

const SANDBOX_MODE = true;

const db = require('../db');
// Placeholder for master lookup utilities (implement as needed)
// const { getStateCodeByGSTIN, getUOMCodeByCylinderType } = require('./masterLookups');

async function getStateCodeByGSTIN(gstin) {
  if (!gstin || typeof gstin !== 'string' || gstin.length < 2) return null;
  return gstin.substring(0, 2);
}

async function getUOMCodeByCylinderType(cylinder_type_id) {
  // Fetch UOM from cylinder_types and gst_uom
  const ctRes = await db.query('SELECT uom FROM cylinder_types WHERE cylinder_type_id = $1', [cylinder_type_id]);
  return ctRes.rows[0]?.uom || 'NOS';
}

function round2(n) {
  return Number(Number(n).toFixed(2));
}

async function generateInvoicePayload(invoice_id) {
  // Fetch all required data
  const invoiceRes = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
  const invoice = invoiceRes.rows[0];
  if (!invoice) throw new Error('Invoice not found');
  const customerRes = await db.query('SELECT * FROM customers WHERE customer_id = $1', [invoice.customer_id]);
  const customer = customerRes.rows[0];
  if (!customer) throw new Error('Customer not found');
  const distributorRes = await db.query('SELECT * FROM distributors WHERE distributor_id = $1', [invoice.distributor_id]);
  const distributor = distributorRes.rows[0];
  if (!distributor) throw new Error('Distributor not found');

  // TEMP: Override GSTINs for sandbox testing
  if (SANDBOX_MODE) {
    distributor.gstin = '09AAAPG7885R002'; // Seller GSTIN (UP)
    customer.gstin = '05AAAPG7885R002';   // Buyer GSTIN (UK)
  }

  // Truncate document_number to 16 chars
  let document_number = invoice.invoice_number;
  if (!document_number || document_number.length > 16) {
    document_number = document_number ? document_number.slice(0, 16) : `INV${Date.now()}`.slice(0, 16);
  }

  // Validate required distributor/customer fields
  if (!distributor.city || !distributor.postal_code) throw new Error('Distributor city and postal_code are required');
  if (!customer.city || !customer.postal_code) throw new Error('Customer city and postal_code are required');

  const itemsRes = await db.query('SELECT ii.*, ct.name as cylinder_name, ct.hsn_code, ct.gst_rate FROM invoice_items ii JOIN cylinder_types ct ON ii.cylinder_type_id = ct.cylinder_type_id WHERE ii.invoice_id = $1', [invoice_id]);
  const items = itemsRes.rows;

  // Extract state codes AFTER any GSTIN override
  const buyer_state_code = customer.gstin ? customer.gstin.substring(0, 2) : customer.state_code;
  const seller_state_code = distributor.gstin ? distributor.gstin.substring(0, 2) : distributor.state_code;

  // Debug logs for GSTINs and state codes
  console.log('DEBUG: seller GSTIN:', distributor.gstin, 'seller_state_code:', seller_state_code);
  console.log('DEBUG: buyer GSTIN:', customer.gstin, 'buyer_state_code:', buyer_state_code);

  const isIntraState = buyer_state_code === seller_state_code;

  const item_list = [];
  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    const uom = await getUOMCodeByCylinderType(item.cylinder_type_id);
    const hsn = item.hsn_code;
    const rate = Number(item.gst_rate) || 5;
    const quantity = Number(item.quantity);
    const price = Number(item.unit_price);
    const discount = Number(item.discount_per_unit) || 0;
    const total_amount = round2(price * quantity);
    const assessable_value = round2(total_amount - discount);
    const cgst = isIntraState ? round2((rate / 2 / 100) * assessable_value) : 0.00;
    const sgst = isIntraState ? round2((rate / 2 / 100) * assessable_value) : 0.00;
    const igst = !isIntraState ? round2((rate / 100) * assessable_value) : 0.00;
    const total_item_value = round2(assessable_value + cgst + sgst + igst);

    item_list.push({
      item_serial_number: (idx + 1).toString(),
      product_description: item.cylinder_name,
      is_service: 'N',
      hsn_code: hsn,
      bar_code: '', // default empty
      quantity,
      free_quantity: 0,
      unit: uom,
      unit_price: price,
      total_amount,
      pre_tax_value: 0,
      discount,
      other_charge: 0,
      assessable_value,
      gst_rate: rate,
      igst_amount: igst,
      cgst_amount: cgst,
      sgst_amount: sgst,
      total_item_value,
    });
  }

  // Sums for value_details
  const total_assessable_value = round2(item_list.reduce((sum, item) => sum + item.assessable_value, 0));
  const total_igst_value = round2(item_list.reduce((sum, item) => sum + item.igst_amount, 0));
  const total_sgst_value = round2(item_list.reduce((sum, item) => sum + item.sgst_amount, 0));
  const total_invoice_value = round2(item_list.reduce((sum, item) => sum + item.total_item_value, 0));

  const value_details = {
    total_assessable_value,
    total_sgst_value,
    total_igst_value,
    total_invoice_value,
    round_off_amount: 0,
    total_invoice_value_additional_currency: 0,
  };

  const payload = {
    version: "1.1",
    transaction_details: {
      supply_type: "B2B",
      igst_on_intra: "N",
      e_commerce_gstin: null,
    },
    document_details: {
      document_type: "INV",
      document_number,
      document_date: invoice.issue_date ? invoice.issue_date.toISOString().slice(0, 10) : null,
    },
    seller_details: {
      gstin: distributor.gstin,
      legal_name: distributor.legal_name || distributor.business_name,
      address1: distributor.address_line1,
      location: distributor.city,
      pincode: distributor.postal_code,
      state_code: seller_state_code,
    },
    buyer_details: {
      gstin: customer.gstin,
      legal_name: customer.legal_name || customer.business_name,
      address1: customer.address_line1,
      location: customer.city,
      pincode: customer.postal_code,
      state_code: buyer_state_code,
      place_of_supply: buyer_state_code, // Ensure this is buyer's state code
    },
    item_list,
    value_details,
  };

  // Debug log to confirm place_of_supply
  console.log('DEBUG: place_of_supply in payload:', payload.buyer_details.place_of_supply);
  return payload;
}

module.exports = { generateInvoicePayload }; 
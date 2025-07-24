// LEGACY: This file is now legacy. Use services/generateInvoicePayload.js for all new invoice payload generation logic.
// Utility to build NIC v1.1 e-Invoice JSON (Expanded)
const db = require('../db');
const moment = require('moment');

// GSTIN format validation helper
function isValidGstin(gstin) {
  return /^[0-9]{2}[A-Z0-9]{13}$/.test(gstin);
}

// Helper to round to 2 decimal places
const round2 = (n) => Number(Number(n).toFixed(2));

async function buildInvoiceJSON_legacy(invoice, customer, distributor, orderItems) {
  // Fetch static lookups
  const [sellerState, buyerState, docType] = await Promise.all([
    db.query('SELECT * FROM gst_states WHERE code = $1', [distributor.state_code])
      .then(result => result.rows[0] || null),
    db.query('SELECT * FROM gst_states WHERE code = $1', [customer.state_code])
      .then(result => result.rows[0] || null),
    db.query('SELECT * FROM gst_doc_types WHERE code = $1', [invoice.doc_type])
      .then(result => result.rows[0] || null)
  ]);

  let sellerGSTIN, buyerGSTIN, userGSTIN;
  if (process.env.IS_SANDBOX === 'true') {
    // FORCE: Masters India sandbox expects these exact GSTINs and state codes
    sellerGSTIN = '09AAAPG7885R002';
    buyerGSTIN = '05AAAPG7885R002';
    userGSTIN = sellerGSTIN;
  } else {
    // Production/real logic
    const fallbackSellerGSTIN = '09AAAPG7885R002';
    const fallbackBuyerGSTIN = '05AAAPG7885R002';
    sellerGSTIN = (distributor.gstin && isValidGstin(distributor.gstin)) ? distributor.gstin.toUpperCase().trim() : fallbackSellerGSTIN;
    buyerGSTIN = (customer.gstin && isValidGstin(customer.gstin)) ? customer.gstin.toUpperCase().trim() : fallbackBuyerGSTIN;
    userGSTIN = sellerGSTIN;
  }

  // place_of_supply: first two digits of buyer GSTIN
  const buyerStateCode = buyerGSTIN.substring(0, 2);

  // Format document_date as DD/MM/YYYY
  const docDate = invoice.issue_date ? moment(invoice.issue_date).format('DD/MM/YYYY') : moment().format('DD/MM/YYYY');

  // Use a unique document number for each IRN request, max 16 chars
  let docNumber = invoice.document_number;
  if (!docNumber || docNumber.length > 16) {
    docNumber = `DOC${Date.now()}`.slice(0, 16);
  }

  // Determine if inter-state (for IGST vs CGST/SGST)
  let isInterState = false;
  let sellerPin = distributor.pincode || '123456';
  let buyerPin = customer.pincode || '654321';
  if (process.env.IS_SANDBOX === 'true') {
    sellerPin = '226001'; // Lucknow, Uttar Pradesh (09)
    buyerPin = '248001';  // Dehradun, Uttarakhand (05)
    isInterState = true;  // Always inter-state for sandbox test GSTINs
  } else {
    isInterState = (sellerGSTIN && buyerGSTIN && sellerGSTIN.substring(0,2) !== buyerGSTIN.substring(0,2));
  }

  // Calculate item values
  const items = await Promise.all(orderItems.map(async (item, idx) => {
    const ctRes = await db.query('SELECT * FROM cylinder_types WHERE cylinder_type_id = $1', [item.cylinder_type_id]);
    const ct = ctRes.rows[0] || {};
    const uom = ct.uom || 'NOS';
    const uomLookup = await db.query('SELECT * FROM gst_uom WHERE code = $1', [uom])
      .then(result => result.rows[0] || null);
    const unit_price = Number(item.unit_price) || 0;
    const quantity = Number(item.quantity) || 1;
    const assessable_value = unit_price * quantity;
    const gst_rate = Number(ct.gst_rate) || 5;
    let igst_amount = 0, cgst_amount = 0, sgst_amount = 0;
    if (isInterState) {
      igst_amount = assessable_value * (gst_rate / 100);
      cgst_amount = 0;
      sgst_amount = 0;
    } else {
      igst_amount = 0;
      cgst_amount = assessable_value * 0.025;
      sgst_amount = assessable_value * 0.025;
    }
    const total_item_value = assessable_value + igst_amount + cgst_amount + sgst_amount;
    return {
      item_serial_number: (idx + 1).toString(),
      product_description: ct.name || item.description || `Cylinder ${idx + 1}`,
      is_service: 'N',
      hsn_code: ct.hsn_code || '27111910',
      bar_code: item.bar_code || '',
      quantity,
      free_quantity: 0,
      unit: uomLookup ? uomLookup.code : uom,
      unit_price: round2(unit_price),
      total_amount: round2(assessable_value),
      pre_tax_value: 0,
      discount: round2(Number(item.discount) || 0),
      other_charge: 0,
      assessable_value: round2(assessable_value),
      gst_rate: round2(gst_rate),
      igst_amount: round2(igst_amount),
      cgst_amount: round2(cgst_amount),
      sgst_amount: round2(sgst_amount),
      total_item_value: round2(total_item_value),
    };
  }));

  // Compute value_details block as per Masters India spec
  const totalAssessable = items.reduce((sum, i) => sum + (i.assessable_value || 0), 0);
  let totalSGST = items.reduce((sum, i) => sum + (i.sgst_amount || 0), 0);
  let totalCGST = items.reduce((sum, i) => sum + (i.cgst_amount || 0), 0);
  const totalIGST = items.reduce((sum, i) => sum + (i.igst_amount || 0), 0);
  const totalInvoice = items.reduce((sum, i) => sum + (i.total_item_value || 0), 0);
  // For inter-state, force CGST/SGST to exactly 0
  if (isInterState) {
    totalCGST = 0;
    totalSGST = 0;
  }
  const value_details = {
    total_assessable_value: round2(totalAssessable),
    total_sgst_value: isInterState ? 0 : round2(totalSGST),
    total_cgst_value: isInterState ? 0 : round2(totalCGST),
    total_igst_value: round2(totalIGST),
    total_invoice_value: round2(totalInvoice),
    round_off_amount: 0,
    total_invoice_value_additional_currency: 0
  };

  // Build JSON as per Masters India IRN API
  const json = {
    user_gstin: userGSTIN,
    data_source: 'erp',
    transaction_details: {
      supply_type: invoice.supply_type || 'B2B',
      charge_type: invoice.charge_type || 'Y',
      igst_on_intra: invoice.igst_on_intra || 'N',
      ecommerce_gstin: invoice.ecommerce_gstin || ''
    },
    document_details: {
      document_type: invoice.doc_type || 'INV',
      document_number: docNumber,
      document_date: docDate
    },
    seller_details: {
      gstin: sellerGSTIN,
      legal_name: distributor.legal_name || 'Test Seller Pvt Ltd',
      trade_name: distributor.trade_name || 'Test Seller',
      address1: distributor.address1 || '123 Test Street',
      address2: distributor.address2 || '',
      location: distributor.location || 'Test City',
      pincode: sellerPin,
      state_code: sellerGSTIN.substring(0, 2),
      phone_number: distributor.phone_number || '9999999999',
      email: distributor.email || 'seller@example.com'
    },
    buyer_details: {
      gstin: buyerGSTIN,
      legal_name: customer.legal_name || 'Test Buyer Pvt Ltd',
      trade_name: customer.trade_name || 'Test Buyer',
      address1: customer.address1 || '456 Buyer Lane',
      address2: customer.address2 || '',
      location: customer.location || 'Buyer City',
      pincode: buyerPin,
      place_of_supply: buyerGSTIN.substring(0, 2),
      state_code: buyerGSTIN.substring(0, 2),
      phone_number: customer.phone_number || '8888888888',
      email: customer.email || 'buyer@example.com'
    },
    value_details,
    item_list: items,
  };

  // FINAL ENFORCEMENT for Masters India sandbox
  if (process.env.IS_SANDBOX === 'true') {
    json.seller_details.gstin = '09AAAPG7885R002';
    json.seller_details.state_code = '09';
    json.buyer_details.gstin = '05AAAPG7885R002';
    json.buyer_details.state_code = '05';
    json.user_gstin = '09AAAPG7885R002';
  }

  // Remove empty blocks (dispatch_details, ship_details, export_details, etc.)
  // Only add if present and non-empty
  if (invoice.dispatch_details && Object.keys(invoice.dispatch_details).length > 0) {
    json.dispatch_details = invoice.dispatch_details;
  }
  if (invoice.ship_details && Object.keys(invoice.ship_details).length > 0) {
    json.ship_details = invoice.ship_details;
  }
  if (invoice.payment_details && Object.keys(invoice.payment_details).length > 0) {
    json.payment_details = invoice.payment_details;
  }
  if (invoice.reference_details && Object.keys(invoice.reference_details).length > 0) {
    json.reference_details = invoice.reference_details;
  }
  if (invoice.export_details && Object.keys(invoice.export_details).length > 0) {
    json.export_details = invoice.export_details;
  }

  return json;
}

module.exports = buildInvoiceJSON_legacy; 
// Utility to build NIC v1.1 e-Invoice JSON (Expanded)
const db = require('../db');

async function buildInvoiceJSON(invoice, customer, distributor, orderItems) {
  // Fetch static lookups
  const [sellerState, buyerState, docType] = await Promise.all([
    db.query('SELECT * FROM gst_states WHERE code = $1', [distributor.state_code])
      .then(result => result.rows[0] || null),
    db.query('SELECT * FROM gst_states WHERE code = $1', [customer.state_code])
      .then(result => result.rows[0] || null),
    db.query('SELECT * FROM gst_doc_types WHERE code = $1', [invoice.doc_type])
      .then(result => result.rows[0] || null)
  ]);

  // Map order items with UOM and HSN lookups
  const items = await Promise.all(orderItems.map(async (item) => {
    const uom = await db.query('SELECT * FROM gst_uom WHERE code = $1', [item.uom])
      .then(result => result.rows[0] || null);
    return {
      hsn_code: item.hsn_code,
      gst_rate: Number(item.gst_rate),
      uom: uom ? uom.code : item.uom,
      uom_description: uom ? uom.description : null,
      cgst_amount: Number(item.cgst_amount),
      sgst_amount: Number(item.sgst_amount),
      igst_amount: Number(item.igst_amount),
      quantity: Number(item.quantity),
      taxable_value: Number(item.taxable_value),
      total_value: Number(item.total_value),
      description: item.description,
      // Add more fields as per your schema
    };
  }));

  // Build JSON as per NIC v1.1
  const json = {
    user_gstin: distributor.gstin,
    data_source: 'erp',
    transaction_details: {
      supply_type: invoice.supply_type || 'B2B',
      charge_type: invoice.charge_type || 'Y',
      igst_on_intra: invoice.igst_on_intra || 'N',
      ecommerce_gstin: invoice.ecommerce_gstin || ''
    },
    document_details: {
      document_type: invoice.doc_type,
      document_number: invoice.document_number,
      document_date: invoice.document_date
    },
    seller_details: {
      gstin: distributor.gstin,
      legal_name: distributor.legal_name,
      trade_name: distributor.trade_name,
      address1: distributor.address1,
      address2: distributor.address2,
      location: distributor.location,
      pincode: distributor.pincode,
      state_code: distributor.state_code,
      state_name: sellerState ? sellerState.name : null,
      phone_number: distributor.phone_number,
      email: distributor.email
    },
    buyer_details: {
      gstin: customer.gstin,
      legal_name: customer.legal_name,
      trade_name: customer.trade_name,
      address1: customer.address1,
      address2: customer.address2,
      location: customer.location,
      pincode: customer.pincode,
      place_of_supply: customer.place_of_supply,
      state_code: customer.state_code,
      state_name: buyerState ? buyerState.name : null,
      phone_number: customer.phone_number,
      email: customer.email
    },
    items,
    // Add other required sections as per NIC v1.1 (dispatch_details, ship_details, payment_details, etc.)
    dispatch_details: invoice.dispatch_details || {},
    ship_details: invoice.ship_details || {},
    payment_details: invoice.payment_details || {},
    reference_details: invoice.reference_details || {},
    export_details: invoice.export_details || {},
    // Add more sections as needed
  };
  return json;
}

module.exports = buildInvoiceJSON;
// Manual test: Call with real invoice data and verify output JSON structure. 
const pool = require('../db.js');
const { getEffectiveUserId } = require('../utils/authUtils');

// Helper function to get distributor settings
async function getDistributorSettings(client, distributor_id) {
  const settingsQuery = `
    SELECT setting_key, setting_value 
    FROM distributor_settings 
    WHERE distributor_id = $1::uuid
  `;
  const settingsResult = await client.query(settingsQuery, [distributor_id]);
  
  // Convert to object for easier access with defaults
  const settings = {
    due_date_credit_notes: 2,
    due_date_invoice_disputes: 2,
    due_date_customer_modifications: 2,
    due_date_inventory_adjustments: 2,
    due_date_accountability_logs: 2,
    due_date_stock_replenishment: 0,
    due_date_unallocated_payments: 2
  };
  
  settingsResult.rows.forEach(row => {
    settings[row.setting_key] = parseInt(row.setting_value) || settings[row.setting_key];
  });
  
  return settings;
}

// GET /pending-actions/:distributor_id
const getPendingActions = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { distributor_id } = req.params;
    const { role } = req.query;
    const userRole = req.user.role;
    
    // Validate distributor_id access
    if (userRole !== 'super_admin' && req.user.distributor_id !== distributor_id) {
      return res.status(403).json({ error: 'Access denied to this distributor' });
    }

    console.log('🔍 Pending actions request for distributor:', distributor_id, 'role:', role || userRole);

    let response = {};

    // For distributor role or when no specific role requested
    if (!role || role === 'distributor' || userRole === 'distributor_admin') {
      response = await getDistributorPendingActions(client, distributor_id);
    }
    // For inventory role
    else if (role === 'inventory' || userRole === 'inventory') {
      response = await getInventoryPendingActions(client, distributor_id);
    }
    // For finance role
    else if (role === 'finance' || userRole === 'finance') {
      response = await getFinancePendingActions(client, distributor_id);
    }
    // For super admin - show all
    else if (userRole === 'super_admin') {
      response = await getAllPendingActions(client, distributor_id);
    }

    console.log('✅ Pending actions response:', response);
    res.json({ data: response });

  } catch (error) {
    console.error('❌ Pending actions error:', error);
    res.status(500).json({ error: 'Failed to fetch pending actions', details: error.message });
  } finally {
    client.release();
  }
};

// Get distributor's pending actions (credit notes, disputes, customer mods, manual adjustments)
async function getDistributorPendingActions(client, distributor_id) {
  const result = {};
  
  // Get distributor settings
  const settings = await getDistributorSettings(client, distributor_id);

  // 1. Credit Notes
  const creditNotesQuery = `
    SELECT 
      cn.credit_note_id as action_id,
      'credit_note' as action_type,
      'Credit Note Request' as title,
      CONCAT('Credit note for Invoice #', i.invoice_number, ' - ', cn.reason) as description,
      'pending' as status,
      cn.created_at,
      cn.created_at + INTERVAL '${settings.due_date_credit_notes} days' as due_date,
      i.invoice_id as related_id,
      i.invoice_number as reference_number
    FROM credit_notes cn
    JOIN invoices i ON cn.invoice_id = i.invoice_id
    WHERE i.distributor_id = $1::uuid AND cn.issued_at IS NULL
    ORDER BY cn.created_at DESC
  `;
  const creditNotesResult = await client.query(creditNotesQuery, [distributor_id]);
  result.credit_notes = creditNotesResult.rows;

  // 2. Invoice Disputes
  const disputesQuery = `
    SELECT 
      id.dispute_id as action_id,
      'invoice_dispute' as action_type,
      'Invoice Dispute' as title,
      CONCAT('Dispute for Invoice #', i.invoice_number, ' - ', id.reason) as description,
      id.status,
      id.created_at,
      id.created_at + INTERVAL '${settings.due_date_invoice_disputes} days' as due_date,
      i.invoice_id as related_id,
      i.invoice_number as reference_number
    FROM invoice_disputes id
    JOIN invoices i ON id.invoice_id = i.invoice_id
    WHERE i.distributor_id = $1::uuid AND id.status = 'pending'
    ORDER BY id.created_at DESC
  `;
  const disputesResult = await client.query(disputesQuery, [distributor_id]);
  result.invoice_disputes = disputesResult.rows;

  // 3. Customer Modification Requests
  const customerModsQuery = `
    SELECT 
      cmr.request_id as action_id,
      'customer_modification' as action_type,
      'Customer Modification Request' as title,
      CONCAT(cmr.request_type, ' for ', c.business_name) as description,
      cmr.status,
      cmr.created_at,
      cmr.created_at + INTERVAL '${settings.due_date_customer_modifications} days' as due_date,
      c.customer_id as related_id,
      c.business_name as reference_number
    FROM customer_modification_requests cmr
    JOIN customers c ON cmr.customer_id = c.customer_id
    WHERE c.distributor_id = $1::uuid AND cmr.status = 'pending'
    ORDER BY cmr.created_at DESC
  `;
  const customerModsResult = await client.query(customerModsQuery, [distributor_id]);
  result.customer_modification_requests = customerModsResult.rows;

  // Note: Manual inventory adjustments removed from distributor view
  // These are now handled by inventory team for missing/damaged cylinders only
  result.manual_inventory_adjustments = [];

  // 5. Summary counts for other teams
  const summaryQuery = `
    SELECT 
      (
        (SELECT COUNT(*) FROM accountability_logs al 
         WHERE al.distributor_id = $1::uuid AND al.status = 'pending') +
        (SELECT COUNT(*) FROM orders o
         WHERE o.distributor_id = $1::uuid 
           AND o.status = 'delivered' 
           AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.order_id = o.order_id)) +
        (SELECT COUNT(*) FROM stock_replenishment_requests srr
         WHERE srr.distributor_id = $1::uuid AND srr.status = 'pending') +
        (SELECT COUNT(*) FROM manual_inventory_adjustments mia
         WHERE mia.distributor_id = $1::uuid 
           AND mia.status = 'pending'
           AND (mia.reason ILIKE '%missing%' OR mia.reason ILIKE '%damaged%' OR mia.reason ILIKE '%lost%'))
      ) as inventory_team_count,
      (SELECT COUNT(*) FROM payment_transactions pt 
       WHERE pt.distributor_id = $1::uuid AND pt.allocation_status = 'UNALLOCATED') as finance_team_count
  `;
  const summaryResult = await client.query(summaryQuery, [distributor_id]);
  result.summary = summaryResult.rows[0];

  return result;
}

// Get inventory team's pending actions
async function getInventoryPendingActions(client, distributor_id) {
  const result = {};
  
  // Get distributor settings
  const settings = await getDistributorSettings(client, distributor_id);

  // 1. Missing Cylinder Logs (Accountability Logs)
  const accountabilityQuery = `
    SELECT 
      al.log_id as action_id,
      'missing_cylinder_log' as action_type,
      'Missing Cylinder Log' as title,
      al.description as description,
      al.status,
      al.created_at,
      al.created_at + INTERVAL '${settings.due_date_accountability_logs} days' as due_date,
      al.log_id as related_id,
      'Accountability Log' as reference_number
    FROM accountability_logs al
    WHERE al.distributor_id = $1::uuid AND al.status = 'pending'
    ORDER BY al.created_at DESC
  `;
  const accountabilityResult = await client.query(accountabilityQuery, [distributor_id]);
  result.accountability_logs = accountabilityResult.rows;

  // 2. Unreconciled Orders (delivered but no invoice)
  const unreconciledOrdersQuery = `
    SELECT 
      o.order_id as action_id,
      'unreconciled_order' as action_type,
      'Unreconciled Order' as title,
      CONCAT('Order #', o.order_number, ' delivered but invoice not generated') as description,
      'pending' as status,
      o.updated_at as created_at,
      o.updated_at + INTERVAL '${settings.due_date_accountability_logs} days' as due_date,
      o.order_id as related_id,
      o.order_number as reference_number
    FROM orders o
    WHERE o.distributor_id = $1::uuid 
      AND o.status = 'delivered' 
      AND NOT EXISTS (
        SELECT 1 FROM invoices i WHERE i.order_id = o.order_id
      )
    ORDER BY o.updated_at DESC
  `;
  const unreconciledOrdersResult = await client.query(unreconciledOrdersQuery, [distributor_id]);
  result.unreconciled_orders = unreconciledOrdersResult.rows;

  // 3. Manual Inventory Adjustments (only for missing/damaged cylinders)
  const adjustmentsQuery = `
    SELECT 
      mia.adjustment_id as action_id,
      'manual_inventory_adjustment' as action_type,
      'Manual Inventory Adjustment' as title,
      CONCAT(mia.adjustment_type, ' ', mia.quantity, ' ', ct.name, ' - ', mia.reason) as description,
      mia.status,
      mia.created_at,
      mia.created_at + INTERVAL '${settings.due_date_inventory_adjustments} days' as due_date,
      ct.cylinder_type_id as related_id,
      ct.name as reference_number
    FROM manual_inventory_adjustments mia
    JOIN cylinder_types ct ON mia.cylinder_type_id = ct.cylinder_type_id
    WHERE mia.distributor_id = $1::uuid 
      AND mia.status = 'pending'
      AND (mia.reason ILIKE '%missing%' OR mia.reason ILIKE '%damaged%' OR mia.reason ILIKE '%lost%')
    ORDER BY mia.created_at DESC
  `;
  const adjustmentsResult = await client.query(adjustmentsQuery, [distributor_id]);
  result.manual_inventory_adjustments = adjustmentsResult.rows;

  // 4. Stock Replenishment Requests
  const replenishmentQuery = `
    SELECT 
      srr.request_id as action_id,
      'stock_replenishment' as action_type,
      'Stock Replenishment Request' as title,
      CONCAT('Request for ', srr.quantity, ' ', ct.name) as description,
      srr.status,
      srr.created_at,
      srr.created_at + INTERVAL '${settings.due_date_stock_replenishment} days' as due_date,
      ct.cylinder_type_id as related_id,
      ct.name as reference_number
    FROM stock_replenishment_requests srr
    JOIN cylinder_types ct ON srr.cylinder_type_id = ct.cylinder_type_id
    WHERE srr.distributor_id = $1::uuid AND srr.status = 'pending'
    ORDER BY srr.created_at DESC
  `;
  const replenishmentResult = await client.query(replenishmentQuery, [distributor_id]);
  result.stock_replenishment_requests = replenishmentResult.rows;

  return result;
}

// Get finance team's pending actions
async function getFinancePendingActions(client, distributor_id) {
  const result = {};
  
  // Get distributor settings
  const settings = await getDistributorSettings(client, distributor_id);

  // 1. Unallocated Payments
  const unallocatedPaymentsQuery = `
    SELECT 
      pt.payment_id as action_id,
      'unallocated_payment' as action_type,
      'Unallocated Payment' as title,
      CONCAT('Payment of ', pt.amount, ' from ', pt.payment_method, ' needs allocation') as description,
      'pending' as status,
      pt.created_at,
      pt.created_at + INTERVAL '${settings.due_date_unallocated_payments} days' as due_date,
      pt.payment_id as related_id,
      pt.payment_id as reference_number
    FROM payment_transactions pt
    WHERE pt.distributor_id = $1::uuid AND pt.allocation_status = 'UNALLOCATED'
    ORDER BY pt.created_at DESC
  `;
  const unallocatedPaymentsResult = await client.query(unallocatedPaymentsQuery, [distributor_id]);
  result.unallocated_payments = unallocatedPaymentsResult.rows;

  // 2. GST Invoice Sync Failures - Commented out as gst_sync_status column doesn't exist
  // TODO: Add gst_sync_status column to invoices table when GST integration is implemented
  result.gst_sync_failures = [];

  // 3. Credit Notes (pending approval)
  const creditNotesQuery = `
    SELECT 
      cn.credit_note_id as action_id,
      'credit_note' as action_type,
      'Credit Note Approval' as title,
      CONCAT('Credit note for Invoice #', i.invoice_number, ' - ', cn.reason) as description,
      'pending' as status,
      cn.created_at,
      cn.created_at + INTERVAL '${settings.due_date_credit_notes} days' as due_date,
      i.invoice_id as related_id,
      i.invoice_number as reference_number
    FROM credit_notes cn
    JOIN invoices i ON cn.invoice_id = i.invoice_id
    WHERE i.distributor_id = $1::uuid AND cn.issued_at IS NULL
    ORDER BY cn.created_at DESC
  `;
  const creditNotesResult = await client.query(creditNotesQuery, [distributor_id]);
  result.credit_notes = creditNotesResult.rows;

  return result;
}

// Get all pending actions for super admin
async function getAllPendingActions(client, distributor_id) {
  const distributorActions = await getDistributorPendingActions(client, distributor_id);
  const inventoryActions = await getInventoryPendingActions(client, distributor_id);
  const financeActions = await getFinancePendingActions(client, distributor_id);

  return {
    ...distributorActions,
    ...inventoryActions,
    ...financeActions
  };
}

module.exports = {
  getPendingActions
}; 
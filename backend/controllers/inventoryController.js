const pool = require('../db.js');
const { getEffectiveUserId } = require('../utils/authUtils');

// GET /inventory/summary/:date
const getInventorySummary = async (req, res) => {
  try {
    const { role, distributor_id } = req.user;
    const { date } = req.params;
    let targetDistributorId = distributor_id;
    // For super_admin, allow filtering by query param, or return all if not provided
    if (role === 'super_admin' && req.query.distributor_id) {
      targetDistributorId = req.query.distributor_id;
    }
    // Get all cylinder types with names
    const cylinderTypesResult = await pool.query(
      `SELECT cylinder_type_id, name FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL`
    );
    const cylinderTypes = cylinderTypesResult.rows;
    const summaries = [];
    for (const cylinderType of cylinderTypes) {
      let rows;
      if (role === 'super_admin' && !targetDistributorId) {
        // Return all summaries for this date/type (all distributors)
        const result = await pool.query(
          `SELECT * FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2`,
          [date, cylinderType.cylinder_type_id]
        );
        rows = result.rows;
      } else {
        // Filter by distributor_id
        const result = await pool.query(
          `SELECT * FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
          [date, cylinderType.cylinder_type_id, targetDistributorId]
        );
        rows = result.rows;
      }
      let summary = rows[0];
      if (!summary) {
        // Get previous day's closing as today's opening
        let prev;
        if (role === 'super_admin' && !targetDistributorId) {
          prev = await pool.query(
            `SELECT closing_fulls, closing_empties FROM inventory_daily_summary WHERE date < $1 AND cylinder_type_id = $2 ORDER BY date DESC LIMIT 1`,
            [date, cylinderType.cylinder_type_id]
          );
        } else {
          prev = await pool.query(
            `SELECT closing_fulls, closing_empties FROM inventory_daily_summary WHERE date < $1 AND cylinder_type_id = $2 AND distributor_id = $3 ORDER BY date DESC LIMIT 1`,
            [date, cylinderType.cylinder_type_id, targetDistributorId]
          );
        }
        summary = {
          id: null,
          date,
          cylinder_type_id: cylinderType.cylinder_type_id,
          cylinder_name: cylinderType.name,
          opening_fulls: prev.rows[0]?.closing_fulls || 0,
          opening_empties: prev.rows[0]?.closing_empties || 0,
          replenished_qty_from_corp: 0,
          empties_sent_to_corp: 0,
          soft_blocked_qty: 0, // will fill below
          delivered_qty: 0,
          collected_empties_qty: 0,
          damaged_qty: 0,
          closing_fulls: 0,
          closing_empties: 0,
          status: 'pending',
          created_at: null
        };
      } else {
        summary.cylinder_name = cylinderType.name;
      }
      // Calculate soft_blocked_qty from orders
      let softBlockResult;
      if (role === 'super_admin' && !targetDistributorId) {
        softBlockResult = await pool.query(
          `SELECT COALESCE(SUM(oi.quantity),0) AS soft_blocked_qty
           FROM orders o
           JOIN order_items oi ON o.order_id = oi.order_id
           WHERE o.status IN ('pending','processing')
             AND o.delivery_date = $1
             AND oi.cylinder_type_id = $2`,
          [date, cylinderType.cylinder_type_id]
        );
      } else {
        softBlockResult = await pool.query(
          `SELECT COALESCE(SUM(oi.quantity),0) AS soft_blocked_qty
           FROM orders o
           JOIN order_items oi ON o.order_id = oi.order_id
           WHERE o.status IN ('pending','processing')
             AND o.delivery_date = $1
             AND oi.cylinder_type_id = $2
             AND o.distributor_id = $3`,
          [date, cylinderType.cylinder_type_id, targetDistributorId]
        );
      }
      summary.soft_blocked_qty = Number(softBlockResult.rows[0].soft_blocked_qty);
      summaries.push(summary);
    }
    res.json(summaries);
  } catch (err) {
    console.error('getInventorySummary error:', err);
    res.status(500).json({ error: 'Failed to fetch inventory summary' });
  }
};

// POST /inventory/summary/:date
const upsertInventorySummary = async (req, res) => {
  try {
    // const { distributor_id } = req.user; // TODO: Add auth-based filtering later
    const { date } = req.params;
    const { updates } = req.body; // [{cylinder_type_id, closing_fulls, closing_empties, lost, empties_sent_to_corp}]
    if (!Array.isArray(updates)) return res.status(400).json({ error: 'Invalid updates' });
    for (const upd of updates) {
      // Upsert summary row
      const { cylinder_type_id, closing_fulls, closing_empties, lost, empties_sent_to_corp } = upd;
      // Try to find existing summary
      const { rows } = await pool.query(
        `SELECT * FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2`,
        [date, cylinder_type_id]
      );
      let summaryId = rows[0]?.id;
      if (!summaryId) {
        // Insert new summary row
        const ins = await pool.query(
          `INSERT INTO inventory_daily_summary (date, cylinder_type_id, closing_fulls, closing_empties, lost, empties_sent_to_corp)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [date, cylinder_type_id, closing_fulls ?? 0, closing_empties ?? 0, lost ?? 0, empties_sent_to_corp ?? 0]
        );
        summaryId = ins.rows[0].id;
      } else {
        // Update existing summary row
        await pool.query(
          `UPDATE inventory_daily_summary SET closing_fulls = $1, closing_empties = $2, lost = $3, empties_sent_to_corp = $4, status = 'pending', created_at = NOW() WHERE id = $5`,
          [closing_fulls ?? rows[0].closing_fulls, closing_empties ?? rows[0].closing_empties, lost ?? rows[0].lost, empties_sent_to_corp ?? rows[0].empties_sent_to_corp, summaryId]
        );
      }
      // Insert into adjustment requests for approval (only for lost)
      if (lost !== undefined) {
        await pool.query(
          `INSERT INTO inventory_adjustment_requests (summary_id, cylinder_type_id, date, field, requested_value, previous_value)
           VALUES ($1, $2, $3, 'lost', $4, (SELECT lost FROM inventory_daily_summary WHERE id = $1))`,
          [summaryId, cylinder_type_id, date, lost]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('upsertInventorySummary error:', err);
    res.status(500).json({ error: 'Failed to update inventory summary' });
  }
};

// PATCH /inventory/approve-adjustment
const approveInventoryAdjustment = async (req, res) => {
  try {
    const { adjustment_ids, admin_id } = req.body; // [UUID]
    if (!Array.isArray(adjustment_ids) || !admin_id) return res.status(400).json({ error: 'Invalid input' });
    for (const id of adjustment_ids) {
      // Get the adjustment request
      const { rows } = await pool.query('SELECT * FROM inventory_adjustment_requests WHERE id = $1 AND status = $2', [id, 'pending']);
      const reqRow = rows[0];
      if (!reqRow) continue;
      // Update the summary table (only for lost)
      if (reqRow.field === 'lost') {
        await pool.query(
          `UPDATE inventory_daily_summary SET lost = $1, status = 'approved' WHERE id = $2`,
          [reqRow.requested_value, reqRow.summary_id]
        );
      }
      // Mark adjustment as approved
      await pool.query(
        `UPDATE inventory_adjustment_requests SET status = 'approved', approved_by = $1, approved_at = NOW() WHERE id = $2`,
        [admin_id, id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('approveInventoryAdjustment error:', err);
    res.status(500).json({ error: 'Failed to approve adjustment' });
  }
};

// POST /inventory/update-from-delivery
const updateFromDelivery = async (req, res) => {
  const client = await pool.connect();
  try {
    const { distributor_id, date, deliveries } = req.body; // deliveries: [{order_id, order_item_id, customer_id, cylinder_type_id, delivered_qty, empties_collected}]
    if (!distributor_id || !date || !Array.isArray(deliveries)) return res.status(400).json({ error: 'Invalid input' });
    console.log('updateFromDelivery called:', { distributor_id, date, deliveries });
    await client.query('BEGIN');
    for (const d of deliveries) {
      console.log('Processing delivery:', d);
      // 1. Upsert order_delivery_items
      const odiRes = await client.query(
        `SELECT id FROM order_delivery_items WHERE order_item_id = $1`,
        [d.order_item_id]
      );
      console.log('order_delivery_items select result:', odiRes.rows);
      if (odiRes.rows.length === 0) {
        await client.query(
          `INSERT INTO order_delivery_items (order_item_id, delivered_quantity, empties_collected, created_at, updated_at)
           VALUES ($1, $2, $3, NOW(), NOW())`,
          [d.order_item_id, d.delivered_qty, d.empties_collected]
        );
        console.log('Inserted into order_delivery_items:', d.order_item_id);
      } else {
        await client.query(
          `UPDATE order_delivery_items SET delivered_quantity = $1, empties_collected = $2, updated_at = NOW() WHERE order_item_id = $3`,
          [d.delivered_qty, d.empties_collected, d.order_item_id]
        );
        console.log('Updated order_delivery_items:', d.order_item_id);
      }
      await logInventoryAudit(client, {
        action: 'delivery_confirmed',
        entity: 'order_delivery_items',
        entity_id: d.order_item_id,
        details: { delivered_qty: d.delivered_qty, empties_collected: d.empties_collected },
        distributor_id
      });
      // 2. Update customer_inventory_balances
      const balRes = await client.query(
        `SELECT * FROM customer_inventory_balances WHERE customer_id = $1 AND cylinder_type_id = $2`,
        [d.customer_id, d.cylinder_type_id]
      );
      console.log('customer_inventory_balances select result:', balRes.rows);
      const pendingToAdd = Math.max(d.delivered_qty - d.empties_collected, 0);
      const withCustomerDelta = d.delivered_qty - d.empties_collected - pendingToAdd;
      if (balRes.rows.length === 0) {
        await client.query(
          `INSERT INTO customer_inventory_balances (customer_id, cylinder_type_id, with_customer_qty, pending_returns, missing_qty, last_updated)
           VALUES ($1, $2, $3, $4, 0, NOW())`,
          [d.customer_id, d.cylinder_type_id, withCustomerDelta, pendingToAdd]
        );
        console.log('Inserted into customer_inventory_balances:', d.customer_id, d.cylinder_type_id);
      } else {
        await client.query(
          `UPDATE customer_inventory_balances SET with_customer_qty = with_customer_qty + $1, pending_returns = pending_returns + $2, last_updated = NOW() WHERE customer_id = $3 AND cylinder_type_id = $4`,
          [withCustomerDelta, pendingToAdd, d.customer_id, d.cylinder_type_id]
        );
        console.log('Updated customer_inventory_balances:', d.customer_id, d.cylinder_type_id);
      }
      await logInventoryAudit(client, {
        action: 'customer_balance_updated',
        entity: 'customer_inventory_balances',
        entity_id: `${d.customer_id}:${d.cylinder_type_id}`,
        details: { with_customer_qty_delta: withCustomerDelta, pending_returns_delta: pendingToAdd },
        distributor_id
      });
      // 3. Update depot/branch inventory: increment empties by empties_collected
      await client.query(
        `UPDATE inventory SET empty_quantity = empty_quantity + $1, updated_at = NOW() WHERE distributor_id = $2 AND cylinder_type_id = $3`,
        [d.empties_collected, distributor_id, d.cylinder_type_id]
      );
      console.log('Updated inventory (empties):', distributor_id, d.cylinder_type_id, d.empties_collected);
      // 4. Update inventory_daily_summary as before
      const { rows } = await client.query(
        `SELECT * FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
        [date, d.cylinder_type_id, distributor_id]
      );
      console.log('inventory_daily_summary select result:', rows);
      let summaryId;
      if (rows.length === 0) {
        const ins = await client.query(
          `INSERT INTO inventory_daily_summary (date, cylinder_type_id, distributor_id, delivered_qty, collected_empties_qty)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [date, d.cylinder_type_id, distributor_id, d.delivered_qty, d.empties_collected]
        );
        summaryId = ins.rows[0].id;
        console.log('Inserted into inventory_daily_summary:', summaryId);
      } else {
        summaryId = rows[0].id;
        await client.query(
          `UPDATE inventory_daily_summary SET delivered_qty = delivered_qty + $1, collected_empties_qty = collected_empties_qty + $2 WHERE id = $3`,
          [d.delivered_qty, d.empties_collected, summaryId]
        );
        console.log('Updated inventory_daily_summary:', summaryId);
      }
      await logInventoryAudit(client, {
        action: 'summary_updated',
        entity: 'inventory_daily_summary',
        entity_id: summaryId,
        details: { delivered_qty: d.delivered_qty, collected_empties_qty: d.empties_collected },
        distributor_id
      });
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateFromDelivery error:', err);
    res.status(500).json({ error: 'Failed to update from delivery' });
  } finally {
    client.release();
  }
};

// GET /inventory/replenishments?status=pending
const listReplenishments = async (req, res) => {
  try {
    // const { distributor_id } = req.user; // TODO: Add auth-based filtering later
    const { status } = req.query;
    let query = `
      SELECT srr.*, ct.name as cylinder_name 
      FROM stock_replenishment_requests srr
      JOIN cylinder_types ct ON srr.cylinder_type_id = ct.cylinder_type_id
    `;
    const params = [];
    if (status) {
      query += ' WHERE srr.status = $1';
      params.push(status);
    }
    query += ' ORDER BY srr.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('listReplenishments error:', err);
    res.status(500).json({ error: 'Failed to fetch replenishments' });
  }
};

// PATCH /inventory/replenishments/:id
const updateReplenishmentStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_id, review_notes } = req.body;
    if (!['in-transit', 'rejected', 'confirmed'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    // Update status and log admin
    await pool.query(
      `UPDATE stock_replenishment_requests SET status = $1, reviewed_by = $2, reviewed_at = NOW(), review_notes = $3 WHERE request_id = $4`,
      [status, admin_id, review_notes || null, id]
    );
    // If confirmed, add quantity to replenished_qty_from_corp in inventory_daily_summary
    if (status === 'confirmed') {
      const { rows } = await pool.query('SELECT * FROM stock_replenishment_requests WHERE request_id = $1', [id]);
      const reqRow = rows[0];
      if (reqRow) {
        await pool.query(
          `UPDATE inventory_daily_summary SET replenished_qty_from_corp = replenished_qty_from_corp + $1 WHERE date = $2 AND cylinder_type_id = $3 AND distributor_id = $4`,
          [reqRow.quantity, reqRow.date, reqRow.cylinder_type_id, reqRow.distributor_id]
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('updateReplenishmentStatus error:', err);
    res.status(500).json({ error: 'Failed to update replenishment status' });
  }
};

// GET /inventory/adjustments?status=pending
const listPendingAdjustments = async (req, res) => {
  try {
    // const { distributor_id } = req.user; // TODO: Add auth-based filtering later
    const { status } = req.query;
    let query = `
      SELECT iar.*, ct.name as cylinder_name 
      FROM inventory_adjustment_requests iar
      JOIN cylinder_types ct ON iar.cylinder_type_id = ct.cylinder_type_id
    `;
    const params = [];
    if (status) {
      query += ' WHERE iar.status = $1';
      params.push(status);
    }
    query += ' ORDER BY iar.created_at DESC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('listPendingAdjustments error:', err);
    res.status(500).json({ error: 'Failed to fetch adjustments' });
  }
};

// POST /inventory/confirm-return
const confirmReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const { returns } = req.body; // [{order_id, order_item_id, customer_id, cylinder_type_id, confirmed_return_qty}]
    const userId = getEffectiveUserId(req.user);
    if (!Array.isArray(returns) || returns.length === 0) return res.status(400).json({ error: 'Invalid input' });
    await client.query('BEGIN');
    for (const r of returns) {
      // 1. Update order_delivery_items.returned_quantity
      await client.query(
        `UPDATE order_delivery_items SET returned_quantity = $1, updated_at = NOW() WHERE order_item_id = $2`,
        [r.confirmed_return_qty, r.order_item_id]
      );
      // Audit log for order_delivery_items
      await logInventoryAudit(client, {
        action: 'return_confirmed',
        entity: 'order_delivery_items',
        entity_id: r.order_item_id,
        details: { confirmed_return_qty: r.confirmed_return_qty },
        distributor_id: r.distributor_id
      });
      // 2. Get current pending_returns for this customer/type
      const balRes = await client.query(
        `SELECT pending_returns, missing_qty FROM customer_inventory_balances WHERE customer_id = $1 AND cylinder_type_id = $2`,
        [r.customer_id, r.cylinder_type_id]
      );
      if (balRes.rows.length === 0) throw new Error('Customer inventory balance not found');
      const pending = Number(balRes.rows[0].pending_returns);
      const missing = Number(balRes.rows[0].missing_qty);
      // 3. Calculate shortfall (if any)
      const shortfall = Math.max(pending - r.confirmed_return_qty, 0);
      // 4. Update balances: decrement pending_returns, increment missing_qty if shortfall
      await client.query(
        `UPDATE customer_inventory_balances SET pending_returns = GREATEST(pending_returns - $1, 0), missing_qty = missing_qty + $2, last_updated = NOW() WHERE customer_id = $3 AND cylinder_type_id = $4`,
        [r.confirmed_return_qty, shortfall, r.customer_id, r.cylinder_type_id]
      );
      // Audit log for customer_inventory_balances
      await logInventoryAudit(client, {
        action: 'customer_balance_updated',
        entity: 'customer_inventory_balances',
        entity_id: `${r.customer_id}:${r.cylinder_type_id}`,
        details: { pending_returns: pending, missing_qty: missing, confirmed_return_qty: r.confirmed_return_qty },
        distributor_id: r.distributor_id
      });
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('confirmReturn error:', err);
    res.status(500).json({ error: 'Failed to confirm returns' });
  } finally {
    client.release();
  }
};

// GET /inventory/customer-summary/:customer_id
const getCustomerInventorySummary = async (req, res) => {
  try {
    const { customer_id } = req.params;
    if (!customer_id) return res.status(400).json({ error: 'Missing customer_id' });
    // Join with cylinder_types and customers for names and last_updated
    const result = await pool.query(
      `SELECT cib.cylinder_type_id, ct.name AS cylinder_name, cib.with_customer_qty, cib.pending_returns, cib.missing_qty, cib.last_updated, c.business_name AS customer_name
       FROM customer_inventory_balances cib
       JOIN cylinder_types ct ON cib.cylinder_type_id = ct.cylinder_type_id
       JOIN customers c ON cib.customer_id = c.customer_id
       WHERE cib.customer_id = $1`,
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getCustomerInventorySummary error:', err);
    res.status(500).json({ error: 'Failed to fetch customer inventory summary' });
  }
};

// GET /inventory/unaccounted-summary?date=YYYY-MM-DD
const getUnaccountedSummary = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) return res.status(400).json({ error: 'Missing date' });
    // For each customer, cylinder_type, get balances and join customer/cylinder names
    const result = await pool.query(
      `SELECT cib.customer_id, c.business_name AS customer_name, cib.cylinder_type_id, ct.name AS cylinder_name,
              cib.with_customer_qty, cib.pending_returns, cib.missing_qty,
              (cib.with_customer_qty + cib.pending_returns + cib.missing_qty) AS unaccounted, $1::date AS date
       FROM customer_inventory_balances cib
       JOIN customers c ON cib.customer_id = c.customer_id
       JOIN cylinder_types ct ON cib.cylinder_type_id = ct.cylinder_type_id`,
      [date]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getUnaccountedSummary error:', err);
    res.status(500).json({ error: 'Failed to fetch unaccounted summary' });
  }
};

// PATCH /inventory/lock-summary/:date
const lockSummary = async (req, res) => {
  const client = await pool.connect();
  try {
    const { date } = req.params;
    const userId = getEffectiveUserId(req.user);
    if (!req.user || (!req.user.user_id && !req.user.uid && !req.user.firebase_uid)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    await client.query('BEGIN');
    // Only lock if not already locked
    const { rowCount } = await client.query(
      `UPDATE inventory_daily_summary SET status = 'locked' WHERE date = $1 AND status != 'locked'`,
      [date]
    );
    if (rowCount === 0) throw new Error('No rows updated (already locked?)');
    // Audit log
    await logInventoryAudit(client, {
      action: 'summary_locked',
      entity: 'inventory_daily_summary',
      entity_id: date,
      details: { date },
      distributor_id: req.body.distributor_id
    });
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('lockSummary error:', err);
    res.status(500).json({ error: 'Failed to lock summary' });
  } finally {
    client.release();
  }
};

// PATCH /inventory/unlock-summary/:date
const unlockSummary = async (req, res) => {
  const client = await pool.connect();
  try {
    const { date } = req.params;
    const userId = getEffectiveUserId(req.user);
    if (!req.user || (!req.user.user_id && !req.user.uid && !req.user.firebase_uid)) {
      return res.status(403).json({ error: 'Admin only' });
    }
    await client.query('BEGIN');
    // Only unlock if currently locked
    const { rowCount } = await client.query(
      `UPDATE inventory_daily_summary SET status = 'pending' WHERE date = $1 AND status = 'locked'`,
      [date]
    );
    if (rowCount === 0) throw new Error('No rows updated (not locked?)');
    // Audit log
    await logInventoryAudit(client, {
      action: 'summary_unlocked',
      entity: 'inventory_daily_summary',
      entity_id: date,
      details: { date },
      distributor_id: req.body.distributor_id
    });
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('unlockSummary error:', err);
    res.status(500).json({ error: 'Failed to unlock summary' });
  } finally {
    client.release();
  }
};

// PATCH /inventory/admin-override-balance
const adminOverrideBalance = async (req, res) => {
  const client = await pool.connect();
  try {
    const { customer_id, cylinder_type_id, with_customer_qty, pending_returns, missing_qty, reason } = req.body;
    const userId = getEffectiveUserId(req.user);
    if (!customer_id || !cylinder_type_id || !reason) {
      console.error('Override failed: missing required fields', req.body);
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await client.query('BEGIN');
    // Get current values for audit log
    const currentRes = await client.query(
      `SELECT with_customer_qty, pending_returns, missing_qty FROM customer_inventory_balances WHERE customer_id = $1 AND cylinder_type_id = $2`,
      [customer_id, cylinder_type_id]
    );
    if (currentRes.rows.length === 0) {
      console.error('Override failed: customer inventory balance not found', req.body);
      await logInventoryAudit(client, {
        action: 'admin_balance_override_failed',
        entity: 'customer_inventory_balances',
        entity_id: `${customer_id}:${cylinder_type_id}`,
        details: { reason, error: 'customer inventory balance not found', attempted: req.body },
        distributor_id: req.body.distributor_id
      });
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Customer inventory balance not found' });
    }
    const current = currentRes.rows[0];
    // Update with new values
    await client.query(
      `UPDATE customer_inventory_balances SET with_customer_qty = $1, pending_returns = $2, missing_qty = $3, last_updated = NOW() WHERE customer_id = $4 AND cylinder_type_id = $5`,
      [with_customer_qty, pending_returns, missing_qty, customer_id, cylinder_type_id]
    );
    // Audit log with old and new values
    console.log('Attempting to log audit for override:', {
      action: 'admin_balance_override',
      entity: 'customer_inventory_balances',
      entity_id: `${customer_id}:${cylinder_type_id}`,
      details: {
        reason,
        old_values: {
          with_customer_qty: current.with_customer_qty,
          pending_returns: current.pending_returns,
          missing_qty: current.missing_qty
        },
        new_values: {
          with_customer_qty,
          pending_returns,
          missing_qty
        }
      },
      distributor_id: req.body.distributor_id
    });
    await logInventoryAudit(client, {
      action: 'admin_balance_override',
      entity: 'customer_inventory_balances',
      entity_id: `${customer_id}:${cylinder_type_id}`,
      details: {
        reason,
        old_values: {
          with_customer_qty: current.with_customer_qty,
          pending_returns: current.pending_returns,
          missing_qty: current.missing_qty
        },
        new_values: {
          with_customer_qty,
          pending_returns,
          missing_qty
        }
      },
      distributor_id: req.body.distributor_id
    });
    console.log('Audit log for override created.');
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('adminOverrideBalance error:', err);
    await logInventoryAudit(client, {
      action: 'admin_balance_override_failed',
      entity: 'customer_inventory_balances',
      entity_id: `${req.body.customer_id}:${req.body.cylinder_type_id}`,
      details: { reason: req.body.reason, error: err.message, attempted: req.body },
      distributor_id: req.body.distributor_id
    });
    res.status(500).json({ error: 'Failed to override balance', details: err.message });
  } finally {
    client.release();
  }
};

// Helper: log audit action
async function logInventoryAudit(client, { action, entity, entity_id, details, distributor_id }) {
  await client.query(
    `INSERT INTO inventory_audit_log (id, action, entity, entity_id, details, user_id, created_at)
     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, NOW())`,
    [action, entity, entity_id, details, distributor_id || null]
  );
}

// GET /inventory/history/:customer_id/:cylinder_type_id
const getInventoryHistory = async (req, res) => {
  try {
    const { customer_id, cylinder_type_id } = req.params;
    if (!customer_id || !cylinder_type_id) return res.status(400).json({ error: 'Missing customer_id or cylinder_type_id' });
    // entity_id is customer_id:cylinder_type_id
    const entity_id = `${customer_id}:${cylinder_type_id}`;
    const result = await pool.query(
      `SELECT * FROM inventory_audit_log WHERE entity = 'customer_inventory_balances' AND entity_id = $1 ORDER BY created_at DESC`,
      [entity_id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('getInventoryHistory error:', err);
    res.status(500).json({ error: 'Failed to fetch inventory history' });
  }
};

module.exports = {
  getInventorySummary,
  upsertInventorySummary,
  approveInventoryAdjustment,
  updateFromDelivery,
  listReplenishments,
  updateReplenishmentStatus,
  listPendingAdjustments,
  confirmReturn,
  getCustomerInventorySummary,
  getUnaccountedSummary,
  lockSummary,
  unlockSummary,
  adminOverrideBalance,
  getInventoryHistory,
  logInventoryAudit
}; 
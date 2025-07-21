const pool = require('../db.js');
const { getEffectiveUserId } = require('../utils/authUtils');

// GET /dashboard/stats/:distributor_id
const getDashboardStats = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { distributor_id } = req.params;
    const { role } = req.user;
    
    // Validate distributor_id access
    if (role !== 'super_admin' && req.user.distributor_id !== distributor_id) {
      return res.status(403).json({ error: 'Access denied to this distributor' });
    }

    console.log('🔍 Dashboard stats request for distributor:', distributor_id);

    // 1️⃣ orders_today
    const ordersTodayQuery = `
      SELECT COUNT(*) AS orders_today
      FROM orders
      WHERE distributor_id = $1::uuid AND DATE(created_at) = CURRENT_DATE
    `;
    const ordersTodayResult = await client.query(ordersTodayQuery, [distributor_id]);
    const orders_today = parseInt(ordersTodayResult.rows[0]?.orders_today || 0);
    console.log('✅ orders_today:', orders_today);

    // 2️⃣ cylinders_in_stock (latest stock per type)
    const cylindersInStockQuery = `
      SELECT ct.name as cylinder_type, ids.closing_fulls as in_stock
      FROM cylinder_types ct
      LEFT JOIN (
        SELECT DISTINCT ON (cylinder_type_id) 
          cylinder_type_id, closing_fulls, date
        FROM inventory_daily_summary 
        WHERE distributor_id = $1
        ORDER BY cylinder_type_id, date DESC
      ) ids ON ct.cylinder_type_id = ids.cylinder_type_id
      WHERE ct.is_active = TRUE AND ct.deleted_at IS NULL
    `;
    const cylindersInStockResult = await client.query(cylindersInStockQuery, [distributor_id]);
    const cylinders_in_stock = {};
    cylindersInStockResult.rows.forEach(row => {
      cylinders_in_stock[row.cylinder_type] = parseInt(row.in_stock || 0);
    });
    console.log('✅ cylinders_in_stock:', cylinders_in_stock);

    // 3️⃣ overdue_invoices
    const overdueInvoicesQuery = `
      SELECT COUNT(*) AS overdue_invoices
      FROM invoices i
      JOIN customers c ON i.customer_id = c.customer_id
      WHERE i.distributor_id = $1::uuid
        AND i.status IN ('ISSUED/UNPAID', 'PARTIALLY_PAID')
        AND CURRENT_DATE > (i.due_date + INTERVAL '1 day' * c.credit_period_days)
    `;
    const overdueInvoicesResult = await client.query(overdueInvoicesQuery, [distributor_id]);
    const overdue_invoices = parseInt(overdueInvoicesResult.rows[0]?.overdue_invoices || 0);
    console.log('✅ overdue_invoices:', overdue_invoices);

    // 4️⃣ revenue_this_week
    const revenueThisWeekQuery = `
      SELECT COALESCE(SUM(amount), 0) AS revenue_this_week
      FROM payment_transactions
      WHERE distributor_id = $1::uuid
        AND created_at >= date_trunc('week', CURRENT_DATE)
    `;
    const revenueThisWeekResult = await client.query(revenueThisWeekQuery, [distributor_id]);
    const revenue_this_week = parseFloat(revenueThisWeekResult.rows[0]?.revenue_this_week || 0);
    console.log('✅ revenue_this_week:', revenue_this_week);

    // 5️⃣ cylinder_health with auto-trigger for low stock
    const cylinderHealthQuery = `
      SELECT 
        ct.cylinder_type_id,
        ct.name as cylinder_type,
        COALESCE(ids.closing_fulls, 0) as in_stock,
        COALESCE(sct.threshold_quantity, 50) as threshold, -- Default threshold of 50
        CASE WHEN srr.request_id IS NOT NULL THEN true ELSE false END as request_sent,
        srr.created_at as triggered_at
      FROM cylinder_types ct
      LEFT JOIN (
        SELECT DISTINCT ON (cylinder_type_id) 
          cylinder_type_id, closing_fulls, date
        FROM inventory_daily_summary 
        WHERE distributor_id = $1
        ORDER BY cylinder_type_id, date DESC
      ) ids ON ct.cylinder_type_id = ids.cylinder_type_id
      LEFT JOIN settings_cylinder_thresholds sct ON ct.cylinder_type_id = sct.cylinder_type_id AND sct.distributor_id = $1::uuid
      LEFT JOIN (
        SELECT DISTINCT ON (cylinder_type_id) 
          request_id, cylinder_type_id, created_at
        FROM stock_replenishment_requests 
        WHERE distributor_id = $1::uuid AND status IN ('pending', 'in-transit')
        ORDER BY cylinder_type_id, created_at DESC
      ) srr ON ct.cylinder_type_id = srr.cylinder_type_id
      WHERE ct.is_active = TRUE AND ct.deleted_at IS NULL
    `;
    const cylinderHealthResult = await client.query(cylinderHealthQuery, [distributor_id]);
    
    const cylinder_health = [];
    const triggeredRequests = [];

    for (const row of cylinderHealthResult.rows) {
      const in_stock = parseInt(row.in_stock || 0);
      const threshold = parseInt(row.threshold || 50);
      const request_sent = row.request_sent || false;
      const triggered_at = row.triggered_at;

      // Auto-trigger logic: if no request exists and stock is below threshold
      if (!request_sent && in_stock < threshold) {
        console.log(`🚨 Low stock alert for ${row.cylinder_type}: ${in_stock} < ${threshold}`);
        
        // Insert new replenishment request
        const insertRequestQuery = `
          INSERT INTO stock_replenishment_requests 
            (distributor_id, cylinder_type_id, quantity, status, requested_by, created_at)
          VALUES ($1::uuid, $2, $3, 'pending', $4, NOW())
          RETURNING request_id, created_at
        `;
        const requestQuantity = Math.max(threshold - in_stock, 10); // Request at least 10
        const insertResult = await client.query(insertRequestQuery, [
          distributor_id, 
          row.cylinder_type_id, 
          requestQuantity,
          req.user.user_id // Add the requesting user's ID
        ]);
        
        triggeredRequests.push({
          cylinder_type: row.cylinder_type,
          in_stock,
          threshold,
          request_sent: true,
          triggered_at: insertResult.rows[0].created_at
        });
        
        console.log(`✅ Auto-triggered request for ${row.cylinder_type}: ${requestQuantity} units`);
      } else {
        triggeredRequests.push({
          cylinder_type: row.cylinder_type,
          in_stock,
          threshold,
          request_sent,
          triggered_at: triggered_at
        });
      }
    }

    console.log('✅ cylinder_health:', triggeredRequests);

    // Final response
    const response = {
      orders_today,
      cylinders_in_stock,
      overdue_invoices,
      revenue_this_week,
      cylinder_health: triggeredRequests
    };

    console.log('📊 Final dashboard response:', response);
    res.json({ data: response });

  } catch (error) {
    console.error('❌ Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getDashboardStats
}; 
const pool = require('../db');

/**
 * Ensure inventory entry exists for specific date and distributor
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} distributor_id - Distributor UUID
 * @returns {Promise<Object>} - Result summary
 */
const ensureDailyInventoryExists = async (date, distributor_id) => {
  const client = await pool.connect();
  
  try {
    console.log(`🔍 Ensuring inventory exists for ${date}, distributor: ${distributor_id}`);
    
    // Get all active cylinder types
    const cylinderTypesResult = await client.query(
      `SELECT cylinder_type_id, name FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL`
    );
    
    const cylinderTypes = cylinderTypesResult.rows;
    console.log(`📦 Found ${cylinderTypes.length} active cylinder types`);
    
    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const cylinderType of cylinderTypes) {
      // Check if entry exists for this date and cylinder type
      const existingResult = await client.query(
        `SELECT id, opening_fulls, opening_empties, closing_fulls, closing_empties 
         FROM inventory_daily_summary 
         WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );

      // Always proceed to create/update the row (do not skip if exists)
      // Find latest previous entry for carry-forward
      const lastEntryResult = await client.query(
        `SELECT closing_fulls, closing_empties 
         FROM inventory_daily_summary 
         WHERE date < $1 AND cylinder_type_id = $2 AND distributor_id = $3 
         ORDER BY date DESC LIMIT 1`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );

      // Calculate carry-forward values
      const lastEntry = lastEntryResult.rows[0];
      const opening_fulls = lastEntry ? lastEntry.closing_fulls : 0;
      const opening_empties = lastEntry ? lastEntry.closing_empties : 0;
      
      console.log(`📊 Carry-forward for ${cylinderType.name}: ${opening_fulls} fulls, ${opening_empties} empties`);
      
      // Calculate soft-blocked quantity for this date
      const softBlockedResult = await client.query(
        `SELECT COALESCE(SUM(oi.quantity), 0) AS soft_blocked_qty
         FROM orders o
         JOIN order_items oi ON o.order_id = oi.order_id
         WHERE o.status IN ('pending', 'processing')
           AND o.delivery_date = $1
           AND oi.cylinder_type_id = $2
           AND o.distributor_id = $3`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );
      
      const soft_blocked_qty = Number(softBlockedResult.rows[0]?.soft_blocked_qty || 0);
      
      // Calculate delivered quantities for this date from orders
      const deliveryResult = await client.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN o.status IN ('completed', 'delivered') AND oi.is_full = true THEN oi.quantity ELSE 0 END), 0) AS delivered_qty,
          COALESCE(SUM(CASE WHEN o.status IN ('completed', 'delivered') AND oi.is_full = false THEN oi.quantity ELSE 0 END), 0) AS collected_empties_qty
         FROM orders o
         JOIN order_items oi ON o.order_id = oi.order_id
         WHERE o.delivery_date = $1 
           AND oi.cylinder_type_id = $2 
           AND o.distributor_id = $3`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );
      const delivered_qty = Number(deliveryResult.rows[0]?.delivered_qty || 0);
      const collected_empties_qty = Number(deliveryResult.rows[0]?.collected_empties_qty || 0);
      
      // Calculate customer unaccounted for this date
      const custUnaccResult = await client.query(
        `SELECT customer_unaccounted FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );
      const customer_unaccounted = Number(custUnaccResult.rows[0]?.customer_unaccounted || 0);
      
      // Calculate inventory unaccounted for this date
      const invUnaccResult = await client.query(
        `SELECT COALESCE(SUM(count), 0) AS total_unaccounted FROM inventory_unaccounted_audit_log WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
        [date, cylinderType.cylinder_type_id, distributor_id]
      );
      const inventory_unaccounted = Number(invUnaccResult.rows[0]?.total_unaccounted || 0);
      
      // Calculate closing balances with clamping to zero
      const closing_fulls = Math.max(0, opening_fulls + delivered_qty - collected_empties_qty);
      const closing_empties = Math.max(0, opening_empties + collected_empties_qty - delivered_qty);
      
      // Log the calculation for debugging
      console.log(`  📊 Calculation for ${cylinderType.name}:`);
      console.log(`    Opening: ${opening_fulls} fulls, ${opening_empties} empties`);
      console.log(`    Delivered: ${delivered_qty} fulls, Collected: ${collected_empties_qty} empties`);
      console.log(`    Closing: ${closing_fulls} fulls, ${closing_empties} empties`);
      console.log(`    Soft Blocked: ${soft_blocked_qty}`);
      
      // Upsert (insert or update) the summary row for this date/type/distributor
      await client.query(
        `INSERT INTO inventory_daily_summary (
          date, cylinder_type_id, distributor_id,
          opening_fulls, opening_empties,
          soft_blocked_qty,
          delivered_qty, collected_empties_qty,
          customer_unaccounted, inventory_unaccounted,
          closing_fulls, closing_empties,
          status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'calculated', NOW())
        ON CONFLICT (date, cylinder_type_id, distributor_id) DO UPDATE SET
          opening_fulls = EXCLUDED.opening_fulls,
          opening_empties = EXCLUDED.opening_empties,
          soft_blocked_qty = EXCLUDED.soft_blocked_qty,
          delivered_qty = EXCLUDED.delivered_qty,
          collected_empties_qty = EXCLUDED.collected_empties_qty,
          customer_unaccounted = EXCLUDED.customer_unaccounted,
          inventory_unaccounted = EXCLUDED.inventory_unaccounted,
          closing_fulls = EXCLUDED.closing_fulls,
          closing_empties = EXCLUDED.closing_empties
        RETURNING id`,
        [
          date, cylinderType.cylinder_type_id, distributor_id,
          opening_fulls, opening_empties,
          soft_blocked_qty,
          delivered_qty, collected_empties_qty,
          customer_unaccounted, inventory_unaccounted,
          closing_fulls, closing_empties
        ]
      );
    }
    
    const result = {
      date,
      distributor_id,
      cylinder_types_processed: cylinderTypes.length,
      created: createdCount,
      updated: updatedCount,
      skipped: skippedCount,
      success: true
    };
    
    console.log(`🎯 Inventory population complete for ${date}:`, result);
    return result;
    
  } catch (error) {
    console.error(`❌ Error ensuring inventory for ${date}:`, error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  ensureDailyInventoryExists
}; 
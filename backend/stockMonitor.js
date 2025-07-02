import pool from './db.js';

// Configurable threshold per cylinder type (could be fetched from DB in future)
const THRESHOLDS = {
  // 'cylinder_type_id': threshold
  // Example: '3b04abc4-585e-48a2-830a-6e17d5ebef46': 5
};

async function runStockMonitor() {
  try {
    // Get all cylinder types and distributors
    const typesRes = await pool.query('SELECT cylinder_type_id FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL');
    const distsRes = await pool.query('SELECT DISTINCT distributor_id FROM inventory_daily_summary');
    const today = new Date();
    today.setHours(0,0,0,0);
    const prevDate = new Date(today.getTime() - 86400000); // yesterday
    const prevDateStr = prevDate.toISOString().slice(0,10);
    for (const { cylinder_type_id } of typesRes.rows) {
      const threshold = THRESHOLDS[cylinder_type_id] || 5; // default threshold
      for (const { distributor_id } of distsRes.rows) {
        // Get previous day's closing_fulls
        const { rows } = await pool.query(
          `SELECT closing_fulls FROM inventory_daily_summary WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3`,
          [prevDateStr, cylinder_type_id, distributor_id]
        );
        const closing_fulls = rows[0]?.closing_fulls || 0;
        if (closing_fulls < threshold) {
          // Check if a pending replenishment request exists
          const pending = await pool.query(
            `SELECT 1 FROM stock_replenishment_requests WHERE date = $1 AND cylinder_type_id = $2 AND distributor_id = $3 AND status = 'pending'`,
            [today.toISOString().slice(0,10), cylinder_type_id, distributor_id]
          );
          if (pending.rowCount === 0) {
            // Insert replenishment request
            await pool.query(
              `INSERT INTO stock_replenishment_requests (date, cylinder_type_id, distributor_id, quantity, status, created_at)
               VALUES ($1, $2, $3, $4, 'pending', NOW())`,
              [today.toISOString().slice(0,10), cylinder_type_id, distributor_id, threshold - closing_fulls]
            );
            console.log(`Replenishment triggered for ${cylinder_type_id} / ${distributor_id}`);
          }
        }
      }
    }
    console.log('Stock monitor completed.');
  } catch (err) {
    console.error('Stock monitor error:', err);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runStockMonitor();
} 
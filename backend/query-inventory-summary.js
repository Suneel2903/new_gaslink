const pool = require('./db.js');

async function main() {
  try {
    const { rows } = await pool.query('SELECT * FROM inventory_daily_summary ORDER BY date DESC LIMIT 50');
    if (rows.length === 0) {
      console.log('No data found in inventory_daily_summary.');
    } else {
      console.table(rows);
    }
  } catch (err) {
    console.error('Error querying inventory_daily_summary:', err);
  } finally {
    await pool.end();
  }
}

main(); 
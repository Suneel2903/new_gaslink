const pool = require('./db.js');

async function addColumns() {
  try {
    console.log('Adding missing columns...');
    
    // Add lost column to inventory_daily_summary
    await pool.query('ALTER TABLE inventory_daily_summary ADD COLUMN IF NOT EXISTS lost INT NOT NULL DEFAULT 0;');
    console.log('✅ Added lost column to inventory_daily_summary');
    
    // Add missing columns to stock_replenishment_requests
    await pool.query(`
      ALTER TABLE stock_replenishment_requests 
      ADD COLUMN IF NOT EXISTS requested_qty INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS current_stock INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS threshold_qty INT NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS date DATE;
    `);
    console.log('✅ Added columns to stock_replenishment_requests');
    
    // Update existing records
    await pool.query(`
      UPDATE stock_replenishment_requests 
      SET requested_qty = quantity,
          current_stock = 0,
          threshold_qty = 50,
          date = CURRENT_DATE
      WHERE requested_qty IS NULL;
    `);
    console.log('✅ Updated existing records');
    
    console.log('🎉 All columns added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding columns:', error);
  } finally {
    await pool.end();
  }
}

addColumns(); 
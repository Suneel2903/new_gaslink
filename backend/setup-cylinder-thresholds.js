const pool = require('./db.js');
const fs = require('fs');

async function setupCylinderThresholds() {
  try {
    console.log('🔧 Setting up cylinder thresholds table...');
    
    const sql = fs.readFileSync('./sql/add_cylinder_thresholds.sql', 'utf8');
    await pool.query(sql);
    
    console.log('✅ Settings cylinder thresholds table created successfully');
    console.log('📊 Default thresholds set to 50 units for all cylinder types');
    
  } catch (error) {
    console.error('❌ Error creating cylinder thresholds table:', error);
  } finally {
    await pool.end();
  }
}

setupCylinderThresholds(); 
const pool = require('./db.js');
const fs = require('fs');
const path = require('path');

async function insertTestData() {
  try {
    console.log('Inserting test inventory data...');
    
    // Read and execute the SQL file
    const sqlPath = path.join(process.cwd(), 'sql', 'init_inventory_test_data.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    await pool.query(sqlContent);
    
    console.log('✅ Test inventory data inserted successfully!');
    console.log('\n📊 Test data includes:');
    console.log('   - 7 days of inventory summary data for all cylinder types');
    console.log('   - Pending adjustment requests for today');
    console.log('   - Stock replenishment requests');
    console.log('\n🔗 You can now test the inventory module at:');
    console.log('   - http://localhost:3000/inventory/summary');
    console.log('   - http://localhost:3000/inventory/approvals');
    
  } catch (error) {
    console.error('❌ Error inserting test data:', error);
  } finally {
    await pool.end();
  }
}

insertTestData(); 
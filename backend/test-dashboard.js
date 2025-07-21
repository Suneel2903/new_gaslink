const pool = require('./db.js');

async function testDashboard() {
  try {
    console.log('🧪 Testing dashboard functionality...');
    
    // 1. Check if we have any distributors
    const distributorsResult = await pool.query('SELECT distributor_id, business_name FROM distributors LIMIT 1');
    if (distributorsResult.rows.length === 0) {
      console.log('❌ No distributors found in database');
      return;
    }
    
    const distributor = distributorsResult.rows[0];
    console.log('✅ Found distributor:', distributor.business_name, 'ID:', distributor.distributor_id);
    
    // 2. Check if we have cylinder types
    const cylinderTypesResult = await pool.query('SELECT cylinder_type_id, name FROM cylinder_types WHERE is_active = TRUE');
    console.log('✅ Found cylinder types:', cylinderTypesResult.rows.map(r => r.name));
    
    // 3. Check if we have inventory data
    const inventoryResult = await pool.query(`
      SELECT COUNT(*) as count FROM inventory_daily_summary 
      WHERE distributor_id = $1
    `, [distributor.distributor_id]);
    console.log('✅ Inventory summary records:', inventoryResult.rows[0].count);
    
    // 4. Check if we have orders
    const ordersResult = await pool.query(`
      SELECT COUNT(*) as count FROM orders 
      WHERE distributor_id = $1
    `, [distributor.distributor_id]);
    console.log('✅ Orders count:', ordersResult.rows[0].count);
    
    // 5. Check if we have payments
    const paymentsResult = await pool.query(`
      SELECT COUNT(*) as count FROM payment_transactions 
      WHERE distributor_id = $1
    `, [distributor.distributor_id]);
    console.log('✅ Payments count:', paymentsResult.rows[0].count);
    
    // 6. Check if we have invoices
    const invoicesResult = await pool.query(`
      SELECT COUNT(*) as count FROM invoices 
      WHERE distributor_id = $1
    `, [distributor.distributor_id]);
    console.log('✅ Invoices count:', invoicesResult.rows[0].count);
    
    console.log('\n🎯 Dashboard test completed!');
    console.log('📊 You can now test the API endpoint:');
    console.log(`   GET /api/dashboard/stats/${distributor.distributor_id}`);
    
  } catch (error) {
    console.error('❌ Error testing dashboard:', error);
  } finally {
    await pool.end();
  }
}

testDashboard(); 
const pool = require('./db');

const checkOrderStatus = async () => {
  console.log('🔍 Checking Order Status Values');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  
  try {
    // Check order status enum values
    const statusValues = await client.query(
      `SELECT DISTINCT status FROM orders ORDER BY status`
    );
    
    console.log('\n📋 Available order statuses:');
    statusValues.rows.forEach(row => {
      console.log(`  - ${row.status}`);
    });
    
    // Check sample orders
    const sampleOrders = await client.query(
      `SELECT order_id, status, delivery_date, created_at 
       FROM orders 
       LIMIT 5`
    );
    
    console.log('\n📦 Sample orders:');
    sampleOrders.rows.forEach(order => {
      console.log(`  Order ${order.order_id}: ${order.status} (${order.delivery_date})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking order status:', error);
  } finally {
    client.release();
  }
};

checkOrderStatus().then(() => process.exit(0)); 
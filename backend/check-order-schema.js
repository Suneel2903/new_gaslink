const pool = require('./db');

const checkOrderSchema = async () => {
  console.log('🔍 Checking Order Table Schema');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  
  try {
    // Check order table schema
    const schema = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns 
       WHERE table_name = 'orders'
       ORDER BY ordinal_position`
    );
    
    console.log('\n📋 Orders table schema:');
    schema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Check if there are any orders at all
    const orderCount = await client.query(
      `SELECT COUNT(*) as count FROM orders`
    );
    
    console.log(`\n📊 Total orders: ${orderCount.rows[0].count}`);
    
    if (orderCount.rows[0].count > 0) {
      // Get sample data
      const sampleData = await client.query(
        `SELECT * FROM orders LIMIT 1`
      );
      
      console.log('\n📦 Sample order data:');
      Object.keys(sampleData.rows[0]).forEach(key => {
        console.log(`  ${key}: ${sampleData.rows[0][key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking order schema:', error);
  } finally {
    client.release();
  }
};

checkOrderSchema().then(() => process.exit(0)); 
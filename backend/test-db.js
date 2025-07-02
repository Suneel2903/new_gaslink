import pool from './db.js';

async function testDatabase() {
  try {
    console.log('🔍 Testing database connection...');
    
    // Test basic connection
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully:', result.rows[0]);
    
    // Check if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('distributors', 'users', 'customers', 'orders', 'inventory')
      ORDER BY table_name
    `);
    
    console.log('\n📋 Existing tables:');
    if (tablesResult.rows.length === 0) {
      console.log('❌ No GasLink tables found. Schema needs to be created.');
    } else {
      tablesResult.rows.forEach(row => {
        console.log(`✅ ${row.table_name}`);
      });
    }
    
    // Check if we have any data
    if (tablesResult.rows.length > 0) {
      const dataResult = await pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM distributors) as distributors_count,
          (SELECT COUNT(*) FROM users) as users_count,
          (SELECT COUNT(*) FROM customers) as customers_count,
          (SELECT COUNT(*) FROM orders) as orders_count
      `);
      
      console.log('\n📊 Data counts:');
      console.log(`   Distributors: ${dataResult.rows[0].distributors_count}`);
      console.log(`   Users: ${dataResult.rows[0].users_count}`);
      console.log(`   Customers: ${dataResult.rows[0].customers_count}`);
      console.log(`   Orders: ${dataResult.rows[0].orders_count}`);
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase(); 
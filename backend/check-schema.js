const pool = require('./db');

const checkSchema = async () => {
  console.log('🔍 Checking Inventory Daily Summary Schema');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  
  try {
    // Get table schema
    const schema = await client.query(
      `SELECT column_name, data_type, is_nullable
       FROM information_schema.columns 
       WHERE table_name = 'inventory_daily_summary'
       ORDER BY ordinal_position`
    );
    
    console.log('\n📋 Table Schema:');
    console.log('-'.repeat(40));
    schema.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Get sample data to see what's actually there
    const sampleData = await client.query(
      `SELECT * FROM inventory_daily_summary LIMIT 1`
    );
    
    if (sampleData.rows.length > 0) {
      console.log('\n📊 Sample Data Columns:');
      console.log('-'.repeat(40));
      Object.keys(sampleData.rows[0]).forEach(key => {
        console.log(`  ${key}: ${sampleData.rows[0][key]}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking schema:', error);
  } finally {
    client.release();
  }
};

checkSchema().then(() => process.exit(0)); 
const pool = require('./db');

/**
 * Basic test for inventory continuity system
 */
const testBasicInventory = async () => {
  console.log('🧪 Basic Inventory Continuity Test');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  
  try {
    // Test 1: Check if inventory_daily_summary table exists
    console.log('\n📋 Test 1: Check table schema');
    console.log('-'.repeat(25));
    
    const schemaResult = await client.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'inventory_daily_summary' 
       ORDER BY ordinal_position`
    );
    
    console.log('✅ Table schema:');
    schemaResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type}`);
    });
    
    // Test 2: Check unique constraint
    console.log('\n📋 Test 2: Check unique constraints');
    console.log('-'.repeat(25));
    
    const constraintResult = await client.query(
      `SELECT indexname, indexdef 
       FROM pg_indexes 
       WHERE tablename = 'inventory_daily_summary'`
    );
    
    console.log('✅ Indexes:');
    constraintResult.rows.forEach(row => {
      console.log(`   ${row.indexname}: ${row.indexdef}`);
    });
    
    // Test 3: Check cylinder types
    console.log('\n📋 Test 3: Check cylinder types');
    console.log('-'.repeat(25));
    
    const cylinderResult = await client.query(
      `SELECT cylinder_type_id, name 
       FROM cylinder_types 
       WHERE is_active = TRUE AND deleted_at IS NULL`
    );
    
    console.log(`✅ Found ${cylinderResult.rows.length} active cylinder types:`);
    cylinderResult.rows.forEach(row => {
      console.log(`   ${row.cylinder_type_id}: ${row.name}`);
    });
    
    // Test 4: Check distributors (without status column)
    console.log('\n📋 Test 4: Check distributors');
    console.log('-'.repeat(25));
    
    const distributorResult = await client.query(
      `SELECT distributor_id, name 
       FROM distributors 
       WHERE deleted_at IS NULL`
    );
    
    console.log(`✅ Found ${distributorResult.rows.length} distributors:`);
    distributorResult.rows.forEach(row => {
      console.log(`   ${row.distributor_id}: ${row.name}`);
    });
    
    // Test 5: Check existing inventory data
    console.log('\n📋 Test 5: Check existing inventory data');
    console.log('-'.repeat(25));
    
    const inventoryResult = await client.query(
      `SELECT COUNT(*) as total_entries,
              COUNT(DISTINCT date) as unique_dates,
              COUNT(DISTINCT distributor_id) as unique_distributors,
              COUNT(DISTINCT cylinder_type_id) as unique_cylinder_types
       FROM inventory_daily_summary`
    );
    
    const stats = inventoryResult.rows[0];
    console.log('✅ Inventory summary:');
    console.log(`   Total entries: ${stats.total_entries}`);
    console.log(`   Unique dates: ${stats.unique_dates}`);
    console.log(`   Unique distributors: ${stats.unique_distributors}`);
    console.log(`   Unique cylinder types: ${stats.unique_cylinder_types}`);
    
    // Test 6: Check for gaps in last 10 days
    console.log('\n📋 Test 6: Check for gaps (last 10 days)');
    console.log('-'.repeat(25));
    
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (10 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const gapResult = await client.query(
      `SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS date
       EXCEPT
       SELECT DISTINCT date FROM inventory_daily_summary 
       WHERE distributor_id = $3 AND date BETWEEN $1 AND $2
       ORDER BY date`,
      [startDate, endDate, '11111111-1111-1111-1111-111111111111']
    );
    
    console.log(`✅ Missing dates for distributor 11111111-1111-1111-1111-111111111111:`);
    if (gapResult.rows.length === 0) {
      console.log('   No gaps found!');
    } else {
      gapResult.rows.forEach(row => {
        console.log(`   ${row.date}`);
      });
    }
    
    console.log('\n🎯 Basic tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  testBasicInventory()
    .then(() => {
      console.log('✅ All basic tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Basic tests failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testBasicInventory
}; 
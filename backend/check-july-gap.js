const pool = require('./db');

const checkJulyGap = async () => {
  console.log('🔍 Checking July 7th and 8th Inventory Gap');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  
  try {
    // Check inventory data for July 7th and 8th
    console.log('\n📊 July 7th and 8th Inventory Data:');
    console.log('-'.repeat(40));
    
    const inventoryResult = await client.query(
      `SELECT 
        date,
        ct.name as cylinder_type_name,
        opening_fulls,
        opening_empties,
        soft_blocked_qty,
        delivered_qty,
        collected_empties_qty,
        customer_unaccounted,
        inventory_unaccounted,
        closing_fulls,
        closing_empties,
        status
      FROM inventory_daily_summary ids
      JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
      WHERE date IN ('2025-07-07', '2025-07-08')
        AND distributor_id = $1
      ORDER BY date, ct.name`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    console.log('Inventory Data:');
    inventoryResult.rows.forEach(row => {
      console.log(`${row.date} - ${row.cylinder_type_name}:`);
      console.log(`  Opening: ${row.opening_fulls} fulls, ${row.opening_empties} empties`);
      console.log(`  Closing: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
      console.log(`  Soft Blocked: ${row.soft_blocked_qty}`);
      console.log(`  Delivered: ${row.delivered_qty}, Collected: ${row.collected_empties_qty}`);
      console.log(`  Unaccounted: Customer=${row.customer_unaccounted}, Inventory=${row.inventory_unaccounted}`);
      console.log(`  Status: ${row.status}`);
      console.log('');
    });
    
    // Check carry-forward logic
    console.log('\n🔄 Carry-Forward Analysis:');
    console.log('-'.repeat(30));
    
    const july7Closing = await client.query(
      `SELECT 
        ct.name as cylinder_type_name,
        closing_fulls,
        closing_empties
      FROM inventory_daily_summary ids
      JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
      WHERE date = '2025-07-07'
        AND distributor_id = $1
      ORDER BY ct.name`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    const july8Opening = await client.query(
      `SELECT 
        ct.name as cylinder_type_name,
        opening_fulls,
        opening_empties
      FROM inventory_daily_summary ids
      JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
      WHERE date = '2025-07-08'
        AND distributor_id = $1
      ORDER BY ct.name`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    console.log('July 7th Closing Balances:');
    july7Closing.rows.forEach(row => {
      console.log(`  ${row.cylinder_type_name}: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
    });
    
    console.log('\nJuly 8th Opening Balances:');
    july8Opening.rows.forEach(row => {
      console.log(`  ${row.cylinder_type_name}: ${row.opening_fulls} fulls, ${row.opening_empties} empties`);
    });
    
    // Check for gaps
    console.log('\n❌ Gap Analysis:');
    console.log('-'.repeat(20));
    
    for (let i = 0; i < july7Closing.rows.length; i++) {
      const july7 = july7Closing.rows[i];
      const july8 = july8Opening.rows[i];
      
      if (july7 && july8) {
        const fullsGap = july7.closing_fulls - july8.opening_fulls;
        const emptiesGap = july7.closing_empties - july8.opening_empties;
        
        if (fullsGap !== 0 || emptiesGap !== 0) {
          console.log(`⚠️  ${july7.cylinder_type_name} GAP DETECTED:`);
          console.log(`    Fulls: July 7 closing (${july7.closing_fulls}) → July 8 opening (${july8.opening_fulls}) = Gap: ${fullsGap}`);
          console.log(`    Empties: July 7 closing (${july7.closing_empties}) → July 8 opening (${july8.opening_empties}) = Gap: ${emptiesGap}`);
        } else {
          console.log(`✅ ${july7.cylinder_type_name}: No gap detected`);
        }
      }
    }
    
    // Check if entries exist for both dates
    console.log('\n📅 Date Coverage Check:');
    console.log('-'.repeat(25));
    
    const dateCheck = await client.query(
      `SELECT 
        date,
        COUNT(*) as entries_count
      FROM inventory_daily_summary 
      WHERE distributor_id = $1
        AND date IN ('2025-07-07', '2025-07-08')
      GROUP BY date
      ORDER BY date`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    console.log('Date Coverage:');
    dateCheck.rows.forEach(row => {
      console.log(`  ${row.date}: ${row.entries_count} entries`);
    });
    
    // Check for any missing cylinder types
    const expectedCylinderTypes = await client.query(
      `SELECT COUNT(*) as total_types FROM cylinder_types WHERE is_active = TRUE AND deleted_at IS NULL`
    );
    
    const actualEntries = await client.query(
      `SELECT COUNT(DISTINCT cylinder_type_id) as actual_types 
       FROM inventory_daily_summary 
       WHERE distributor_id = $1 AND date IN ('2025-07-07', '2025-07-08')`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    console.log(`\n📦 Cylinder Type Coverage:`);
    console.log(`  Expected: ${expectedCylinderTypes.rows[0].total_types} types`);
    console.log(`  Actual: ${actualEntries.rows[0].actual_types} types`);
    
    // Check the specific issue from the screenshots
    console.log('\n🔍 Specific Issue Analysis:');
    console.log('-'.repeat(30));
    
    // Check if there are any cancelled stock entries
    const cancelledStockCheck = await client.query(
      `SELECT 
        ct.name as cylinder_type_name,
        SUM(CASE WHEN date = '2025-07-07' THEN 1 ELSE 0 END) as july7_entries,
        SUM(CASE WHEN date = '2025-07-08' THEN 1 ELSE 0 END) as july8_entries
      FROM inventory_daily_summary ids
      JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
      WHERE distributor_id = $1 
        AND date IN ('2025-07-07', '2025-07-08')
      GROUP BY ct.name, ct.cylinder_type_id
      ORDER BY ct.name`,
      ['11111111-1111-1111-1111-111111111111']
    );
    
    console.log('Cylinder Type Coverage by Date:');
    cancelledStockCheck.rows.forEach(row => {
      console.log(`  ${row.cylinder_type_name}: July 7 (${row.july7_entries}), July 8 (${row.july8_entries})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking July gap:', error);
  } finally {
    client.release();
  }
};

// Run the check
checkJulyGap()
  .then(() => {
    console.log('\n✅ July gap analysis complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  }); 
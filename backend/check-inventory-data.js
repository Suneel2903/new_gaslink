const pool = require('./db');

const checkInventoryData = async () => {
  console.log('🔍 Comprehensive Inventory Daily Summary Check');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // 1. Overall table statistics
    console.log('\n📊 1. Overall Table Statistics:');
    console.log('-'.repeat(40));
    
    const stats = await client.query(
      `SELECT 
        COUNT(*) as total_rows,
        COUNT(DISTINCT date) as unique_dates,
        COUNT(DISTINCT cylinder_type_id) as unique_cylinder_types,
        MIN(date) as earliest_date,
        MAX(date) as latest_date
       FROM inventory_daily_summary 
       WHERE distributor_id = $1`,
      [distributorId]
    );
    
    const { total_rows, unique_dates, unique_cylinder_types, earliest_date, latest_date } = stats.rows[0];
    console.log(`Total rows: ${total_rows}`);
    console.log(`Unique dates: ${unique_dates}`);
    console.log(`Unique cylinder types: ${unique_cylinder_types}`);
    console.log(`Date range: ${earliest_date} to ${latest_date}`);
    
    // 2. Check cylinder types
    console.log('\n📦 2. Cylinder Types in Data:');
    console.log('-'.repeat(40));
    
    const cylinderTypes = await client.query(
      `SELECT DISTINCT ct.name, ct.cylinder_type_id
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.distributor_id = $1
       ORDER BY ct.name`,
      [distributorId]
    );
    
    cylinderTypes.rows.forEach(row => {
      console.log(`  ${row.name} (ID: ${row.cylinder_type_id})`);
    });
    
    // 3. Show all dates with data
    console.log('\n📅 3. All Dates with Data:');
    console.log('-'.repeat(40));
    
    const allDates = await client.query(
      `SELECT DISTINCT date 
       FROM inventory_daily_summary 
       WHERE distributor_id = $1 
       ORDER BY date`,
      [distributorId]
    );
    
    console.log(`Found ${allDates.rows.length} dates:`);
    allDates.rows.forEach((row, index) => {
      console.log(`  ${index + 1}. ${row.date}`);
    });
    
    // 4. Check for gaps between dates
    console.log('\n🕳️ 4. Checking for Date Gaps:');
    console.log('-'.repeat(40));
    
    const gaps = [];
    for (let i = 0; i < allDates.rows.length - 1; i++) {
      const currentDate = new Date(allDates.rows[i].date);
      const nextDate = new Date(allDates.rows[i + 1].date);
      const dayDiff = (nextDate - currentDate) / (1000 * 60 * 60 * 24);
      
      if (dayDiff > 1) {
        gaps.push({
          from: allDates.rows[i].date,
          to: allDates.rows[i + 1].date,
          missingDays: dayDiff - 1
        });
      }
    }
    
    if (gaps.length === 0) {
      console.log('✅ No date gaps found');
    } else {
      console.log(`❌ Found ${gaps.length} gaps:`);
      gaps.forEach(gap => {
        console.log(`  - ${gap.from} to ${gap.to} (${gap.missingDays} missing days)`);
      });
    }
    
    // 5. Check carry-forward issues
    console.log('\n🔄 5. Checking Carry-Forward Issues:');
    console.log('-'.repeat(40));
    
    const carryForwardIssues = [];
    
    for (let i = 0; i < allDates.rows.length - 1; i++) {
      const currentDate = allDates.rows[i].date;
      const nextDate = allDates.rows[i + 1].date;
      
      // Get data for both dates
      const currentData = await client.query(
        `SELECT ct.name, ids.closing_fulls, ids.closing_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE ids.date = $1 AND ids.distributor_id = $2
         ORDER BY ct.name`,
        [currentDate, distributorId]
      );
      
      const nextData = await client.query(
        `SELECT ct.name, ids.opening_fulls, ids.opening_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE ids.date = $1 AND ids.distributor_id = $2
         ORDER BY ct.name`,
        [nextDate, distributorId]
      );
      
      // Compare carry-forward
      currentData.rows.forEach((current, j) => {
        const next = nextData.rows[j];
        if (next) {
          const fullsGap = current.closing_fulls - next.opening_fulls;
          const emptiesGap = current.closing_empties - next.opening_empties;
          
          if (fullsGap !== 0 || emptiesGap !== 0) {
            carryForwardIssues.push({
              fromDate: currentDate,
              toDate: nextDate,
              cylinderType: current.name,
              fullsGap,
              emptiesGap,
              fromClosing: current.closing_fulls,
              toOpening: next.opening_fulls
            });
          }
        }
      });
    }
    
    if (carryForwardIssues.length === 0) {
      console.log('✅ No carry-forward issues found');
    } else {
      console.log(`❌ Found ${carryForwardIssues.length} carry-forward issues:`);
      carryForwardIssues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue.fromDate} → ${issue.toDate}: ${issue.cylinderType}`);
        console.log(`     Closing: ${issue.fromClosing} → Opening: ${issue.toOpening} (gap: ${issue.fullsGap})`);
      });
    }
    
    // 6. Show sample data for recent dates
    console.log('\n📋 6. Sample Data (Last 5 Dates):');
    console.log('-'.repeat(40));
    
    const recentDates = allDates.rows.slice(-5);
    
    for (const dateRow of recentDates) {
      const date = dateRow.date;
      console.log(`\n📅 ${date}:`);
      
      const dateData = await client.query(
        `SELECT ct.name, 
                ids.opening_fulls, ids.opening_empties,
                ids.closing_fulls, ids.closing_empties,
                ids.soft_blocked_qty, ids.cancelled_stock
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE ids.date = $1 AND ids.distributor_id = $2
         ORDER BY ct.name`,
        [date, distributorId]
      );
      
      dateData.rows.forEach(row => {
        console.log(`  ${row.name}:`);
        console.log(`    Opening: ${row.opening_fulls} fulls, ${row.opening_empties} empties`);
        console.log(`    Closing: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
        console.log(`    Soft Blocked: ${row.soft_blocked_qty}, Cancelled: ${row.cancelled_stock}`);
      });
    }
    
    // 7. Check for data inconsistencies
    console.log('\n⚠️ 7. Data Inconsistency Check:');
    console.log('-'.repeat(40));
    
    const inconsistencies = await client.query(
      `SELECT 
        date,
        ct.name,
        CASE 
          WHEN opening_fulls < 0 THEN 'Negative opening fulls'
          WHEN opening_empties < 0 THEN 'Negative opening empties'
          WHEN closing_fulls < 0 THEN 'Negative closing fulls'
          WHEN closing_empties < 0 THEN 'Negative closing empties'
          WHEN soft_blocked_qty < 0 THEN 'Negative soft blocked'
          WHEN cancelled_stock < 0 THEN 'Negative cancelled stock'
          ELSE 'OK'
        END as issue
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.distributor_id = $1
         AND (opening_fulls < 0 OR opening_empties < 0 OR 
              closing_fulls < 0 OR closing_empties < 0 OR
              soft_blocked_qty < 0 OR cancelled_stock < 0)
       ORDER BY date, ct.name`,
      [distributorId]
    );
    
    if (inconsistencies.rows.length === 0) {
      console.log('✅ No negative values found');
    } else {
      console.log(`❌ Found ${inconsistencies.rows.length} inconsistencies:`);
      inconsistencies.rows.forEach(row => {
        console.log(`  ${row.date} - ${row.name}: ${row.issue}`);
      });
    }
    
    // 8. Summary
    console.log('\n📋 8. Summary:');
    console.log('-'.repeat(40));
    console.log(`Total rows: ${total_rows}`);
    console.log(`Date gaps: ${gaps.length}`);
    console.log(`Carry-forward issues: ${carryForwardIssues.length}`);
    console.log(`Data inconsistencies: ${inconsistencies.rows.length}`);
    
    if (gaps.length === 0 && carryForwardIssues.length === 0 && inconsistencies.rows.length === 0) {
      console.log('✅ All data looks correct!');
    } else {
      console.log('❌ Issues found that need fixing');
    }
    
  } catch (error) {
    console.error('❌ Error checking inventory data:', error);
  } finally {
    client.release();
  }
};

// Run the check
checkInventoryData()
  .then(() => {
    console.log('\n✅ Inventory data check complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Inventory data check failed:', error);
    process.exit(1);
  }); 
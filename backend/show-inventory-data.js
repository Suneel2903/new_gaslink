const pool = require('./db');

const showInventoryData = async () => {
  console.log('📊 Inventory Daily Summary - All Data');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // Get all data ordered by date and cylinder type
    const allData = await client.query(
      `SELECT 
        ids.date,
        ct.name as cylinder_type,
        ids.opening_fulls,
        ids.opening_empties,
        ids.closing_fulls,
        ids.closing_empties,
        ids.soft_blocked_qty,
        ids.cancelled_stock,
        ids.delivered_qty,
        ids.collected_qty,
        ids.customer_unaccounted,
        ids.inventory_unaccounted
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.distributor_id = $1
       ORDER BY ids.date, ct.name`,
      [distributorId]
    );
    
    console.log(`📊 Found ${allData.rows.length} records\n`);
    
    // Group by date
    const groupedByDate = {};
    allData.rows.forEach(row => {
      if (!groupedByDate[row.date]) {
        groupedByDate[row.date] = [];
      }
      groupedByDate[row.date].push(row);
    });
    
    // Display data by date
    Object.keys(groupedByDate).sort().forEach(date => {
      console.log(`📅 ${date}:`);
      console.log('-'.repeat(50));
      
      groupedByDate[date].forEach(row => {
        console.log(`  ${row.cylinder_type}:`);
        console.log(`    Opening: ${row.opening_fulls} fulls, ${row.opening_empties} empties`);
        console.log(`    Closing: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
        console.log(`    Soft Blocked: ${row.soft_blocked_qty}, Cancelled: ${row.cancelled_stock}`);
        console.log(`    Delivered: ${row.delivered_qty}, Collected: ${row.collected_qty}`);
        console.log(`    Unaccounted: Customer(${row.customer_unaccounted}), Inventory(${row.inventory_unaccounted})`);
        console.log('');
      });
    });
    
    // Check for specific issues
    console.log('\n🔍 Data Quality Check:');
    console.log('-'.repeat(30));
    
    // Check for zero or negative values
    const zeroValues = allData.rows.filter(row => 
      row.opening_fulls === 0 || row.opening_empties === 0 ||
      row.closing_fulls === 0 || row.closing_empties === 0
    );
    
    if (zeroValues.length > 0) {
      console.log(`⚠️ Found ${zeroValues.length} records with zero values:`);
      zeroValues.slice(0, 5).forEach(row => {
        console.log(`  ${row.date} - ${row.cylinder_type}: Opening(${row.opening_fulls},${row.opening_empties}) Closing(${row.closing_fulls},${row.closing_empties})`);
      });
      if (zeroValues.length > 5) {
        console.log(`  ... and ${zeroValues.length - 5} more`);
      }
    } else {
      console.log('✅ No zero values found');
    }
    
    // Check for carry-forward issues
    console.log('\n🔄 Carry-Forward Check:');
    const dates = Object.keys(groupedByDate).sort();
    let carryForwardIssues = 0;
    
    for (let i = 0; i < dates.length - 1; i++) {
      const currentDate = dates[i];
      const nextDate = dates[i + 1];
      
      const currentData = groupedByDate[currentDate];
      const nextData = groupedByDate[nextDate];
      
      currentData.forEach((current, j) => {
        const next = nextData[j];
        if (next && current.cylinder_type === next.cylinder_type) {
          if (current.closing_fulls !== next.opening_fulls || current.closing_empties !== next.opening_empties) {
            console.log(`❌ ${currentDate} → ${nextDate}: ${current.cylinder_type}`);
            console.log(`   Closing: ${current.closing_fulls},${current.closing_empties} → Opening: ${next.opening_fulls},${next.opening_empties}`);
            carryForwardIssues++;
          }
        }
      });
    }
    
    if (carryForwardIssues === 0) {
      console.log('✅ No carry-forward issues found');
    }
    
    console.log(`\n📋 Summary: ${allData.rows.length} records across ${dates.length} dates`);
    console.log(`Carry-forward issues: ${carryForwardIssues}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
};

showInventoryData().then(() => process.exit(0)); 
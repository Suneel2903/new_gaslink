const pool = require('../db');

const debugInventoryDrift = async () => {
  console.log('🔍 Debugging Inventory Drift - Last 30 Days');
  console.log('=' .repeat(60));
  
  const client = await pool.connect();
  
  try {
    // Get date range for last 30 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 Analyzing period: ${startDateStr} to ${endDateStr}`);
    
    // Get all distributors and cylinder types
    const distributors = await client.query(
      `SELECT DISTINCT distributor_id FROM inventory_daily_summary ORDER BY distributor_id`
    );
    
    const cylinderTypes = await client.query(
      `SELECT cylinder_type_id, name FROM cylinder_types WHERE is_active = true ORDER BY name`
    );
    
    console.log(`📊 Found ${distributors.rows.length} distributors and ${cylinderTypes.rows.length} cylinder types`);
    
    const mismatches = [];
    
    // Loop through each distributor and cylinder type
    for (const distributor of distributors.rows) {
      const distributorId = distributor.distributor_id;
      
      for (const cylinderType of cylinderTypes.rows) {
        const cylinderTypeId = cylinderType.cylinder_type_id;
        const cylinderTypeName = cylinderType.name;
        
        console.log(`\n🔍 Checking ${cylinderTypeName} for distributor ${distributorId.substring(0, 8)}...`);
        
                 // Get inventory data for this distributor and cylinder type
         const inventoryData = await client.query(
           `SELECT 
             date,
             opening_fulls,
             opening_empties,
             closing_fulls,
             closing_empties,
             delivered_qty,
             collected_empties_qty,
             soft_blocked_qty,
             damaged_qty,
             customer_unaccounted,
             inventory_unaccounted
            FROM inventory_daily_summary 
            WHERE distributor_id = $1 
              AND cylinder_type_id = $2
              AND date >= $3
              AND date <= $4
            ORDER BY date`,
           [distributorId, cylinderTypeId, startDateStr, endDateStr]
         );
        
                 // Check each date for mismatches
         for (const row of inventoryData.rows) {
           const expectedClosingFulls = row.opening_fulls + row.delivered_qty - row.collected_empties_qty;
           const expectedClosingEmpties = row.opening_empties + row.collected_empties_qty - row.delivered_qty;
          
          const fullsMismatch = row.closing_fulls - expectedClosingFulls;
          const emptiesMismatch = row.closing_empties - expectedClosingEmpties;
          
          if (fullsMismatch !== 0 || emptiesMismatch !== 0) {
            const mismatch = {
              date: row.date,
              distributor_id: distributorId,
              cylinder_type_id: cylinderTypeId,
              cylinder_type_name: cylinderTypeName,
                             opening_fulls: row.opening_fulls,
               opening_empties: row.opening_empties,
               delivered_qty: row.delivered_qty,
               collected_empties_qty: row.collected_empties_qty,
               expected_closing_fulls: expectedClosingFulls,
               actual_closing_fulls: row.closing_fulls,
               expected_closing_empties: expectedClosingEmpties,
               actual_closing_empties: row.closing_empties,
               soft_blocked_qty: row.soft_blocked_qty,
               damaged_qty: row.damaged_qty,
              fulls_mismatch: fullsMismatch,
              empties_mismatch: emptiesMismatch,
              comment: `Mismatch: Fulls ${fullsMismatch > 0 ? '+' : ''}${fullsMismatch}, Empties ${emptiesMismatch > 0 ? '+' : ''}${emptiesMismatch}`
            };
            
            mismatches.push(mismatch);
            
            console.log(`  ❌ ${row.date}: ${mismatch.comment}`);
          } else {
            console.log(`  ✅ ${row.date}: Calculations correct`);
          }
        }
      }
    }
    
    // Generate summary report
    console.log('\n📋 INVENTORY DRIFT ANALYSIS SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total mismatches found: ${mismatches.length}`);
    
    if (mismatches.length > 0) {
      console.log('\n❌ MISMATCHES DETECTED:');
      console.log('-'.repeat(40));
      
      // Group by cylinder type
      const groupedByCylinder = {};
      mismatches.forEach(m => {
        if (!groupedByCylinder[m.cylinder_type_name]) {
          groupedByCylinder[m.cylinder_type_name] = [];
        }
        groupedByCylinder[m.cylinder_type_name].push(m);
      });
      
      Object.keys(groupedByCylinder).forEach(cylinderName => {
        const cylinderMismatches = groupedByCylinder[cylinderName];
        console.log(`\n📦 ${cylinderName} (${cylinderMismatches.length} mismatches):`);
        
        cylinderMismatches.forEach(m => {
          console.log(`  ${m.date}: ${m.comment}`);
          console.log(`    Opening: ${m.opening_fulls}, Delivered: ${m.delivered_qty}, Collected: ${m.collected_qty}`);
          console.log(`    Expected: ${m.expected_closing_fulls}, Actual: ${m.actual_closing_fulls}`);
        });
      });
      
      // Save detailed report to file
      const fs = require('fs');
      const reportPath = './inventory_drift_report.json';
      fs.writeFileSync(reportPath, JSON.stringify(mismatches, null, 2));
      console.log(`\n📄 Detailed report saved to: ${reportPath}`);
      
    } else {
      console.log('✅ No calculation mismatches found!');
    }
    
    // Check for potential root causes
    console.log('\n🔍 POTENTIAL ROOT CAUSE ANALYSIS:');
    console.log('-'.repeat(40));
    
    if (mismatches.length > 0) {
      // Check if soft-blocked is being incorrectly subtracted
      const softBlockedIssues = mismatches.filter(m => 
        Math.abs(m.fulls_mismatch) === m.soft_blocked_qty || 
        Math.abs(m.empties_mismatch) === m.soft_blocked_qty
      );
      
      if (softBlockedIssues.length > 0) {
        console.log(`⚠️ ${softBlockedIssues.length} mismatches appear to be caused by incorrect soft-blocked handling`);
      }
      
             // Check if damaged stock is being incorrectly handled
       const damagedIssues = mismatches.filter(m => 
         Math.abs(m.fulls_mismatch) === m.damaged_qty || 
         Math.abs(m.empties_mismatch) === m.damaged_qty
       );
      
             if (damagedIssues.length > 0) {
         console.log(`⚠️ ${damagedIssues.length} mismatches appear to be caused by incorrect damaged stock handling`);
       }
      
      // Check for systematic errors
      const systematicFulls = mismatches.filter(m => m.fulls_mismatch !== 0);
      const systematicEmpties = mismatches.filter(m => m.empties_mismatch !== 0);
      
      console.log(`📊 Systematic issues: ${systematicFulls.length} fulls mismatches, ${systematicEmpties.length} empties mismatches`);
    }
    
    return mismatches;
    
  } catch (error) {
    console.error('❌ Error debugging inventory drift:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the debug
debugInventoryDrift()
  .then((mismatches) => {
    console.log('\n✅ Inventory drift analysis complete!');
    console.log(`Found ${mismatches.length} mismatches to investigate.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Inventory drift analysis failed:', error);
    process.exit(1);
  }); 
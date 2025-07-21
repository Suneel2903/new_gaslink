const pool = require('./db');

const fixExistingCalculations = async () => {
  console.log('🔧 Fixing Existing Inventory Calculations');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // Get all inventory entries that need recalculation
    const inventoryEntries = await client.query(
      `SELECT 
        ids.id,
        ids.date,
        ct.name as cylinder_type,
        ids.opening_fulls,
        ids.opening_empties,
        ids.closing_fulls,
        ids.closing_empties,
        ids.delivered_qty,
        ids.collected_empties_qty,
        ids.soft_blocked_qty
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.distributor_id = $1
       ORDER BY ids.date, ct.name`,
      [distributorId]
    );
    
    console.log(`📊 Found ${inventoryEntries.rows.length} entries to check`);
    
    let fixedCount = 0;
    let correctCount = 0;
    
    for (const entry of inventoryEntries.rows) {
      // Calculate expected closing balances with correct formula
      const expectedClosingFulls = entry.opening_fulls + entry.delivered_qty - entry.collected_empties_qty;
      const expectedClosingEmpties = entry.opening_empties + entry.collected_empties_qty - entry.delivered_qty;
      
      const fullsMismatch = entry.closing_fulls - expectedClosingFulls;
      const emptiesMismatch = entry.closing_empties - expectedClosingEmpties;
      
      if (fullsMismatch !== 0 || emptiesMismatch !== 0) {
        console.log(`\n❌ ${entry.date} - ${entry.cylinder_type}:`);
        console.log(`  Opening: ${entry.opening_fulls} fulls, ${entry.opening_empties} empties`);
        console.log(`  Delivered: ${entry.delivered_qty}, Collected: ${entry.collected_empties_qty}`);
        console.log(`  Expected closing: ${expectedClosingFulls} fulls, ${expectedClosingEmpties} empties`);
        console.log(`  Actual closing: ${entry.closing_fulls} fulls, ${entry.closing_empties} empties`);
        console.log(`  Mismatch: ${fullsMismatch} fulls, ${emptiesMismatch} empties`);
        
        // Update with correct values
        await client.query(
          `UPDATE inventory_daily_summary 
           SET closing_fulls = $1, closing_empties = $2
           WHERE id = $3`,
          [expectedClosingFulls, expectedClosingEmpties, entry.id]
        );
        
        console.log(`  ✅ Fixed closing balances`);
        fixedCount++;
      } else {
        correctCount++;
      }
    }
    
    console.log(`\n📋 Summary:`);
    console.log(`  Fixed: ${fixedCount} entries`);
    console.log(`  Already correct: ${correctCount} entries`);
    console.log(`  Total: ${inventoryEntries.rows.length} entries`);
    
    if (fixedCount > 0) {
      console.log(`\n✅ Successfully fixed ${fixedCount} calculation errors!`);
    } else {
      console.log(`\n✅ All calculations are already correct!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing calculations:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the fix
fixExistingCalculations()
  .then(() => {
    console.log('\n✅ Calculation fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Calculation fix failed:', error);
    process.exit(1);
  }); 
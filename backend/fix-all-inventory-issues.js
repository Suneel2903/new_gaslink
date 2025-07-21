const pool = require('./db');

const fixAllInventoryIssues = async () => {
  console.log('🔧 Fixing All Inventory Issues');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // Step 1: Get all inventory entries
    const allEntries = await client.query(
      `SELECT 
        ids.id,
        ids.date,
        ct.name as cylinder_type,
        ct.cylinder_type_id,
        ids.opening_fulls,
        ids.opening_empties,
        ids.closing_fulls,
        ids.closing_empties,
        ids.delivered_qty,
        ids.collected_empties_qty,
        ids.soft_blocked_qty,
        ids.status
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.distributor_id = $1
       ORDER BY ids.date, ct.name`,
      [distributorId]
    );
    
    console.log(`📊 Found ${allEntries.rows.length} entries to analyze`);
    
    let fixedCount = 0;
    let issuesFound = 0;
    
    // Step 2: Fix each entry
    for (const entry of allEntries.rows) {
      let needsUpdate = false;
      const updates = {};
      
      console.log(`\n🔍 Checking ${entry.date} - ${entry.cylinder_type}:`);
      
      // Issue 1: Fix negative closing balances
      if (entry.closing_fulls < 0 || entry.closing_empties < 0) {
        console.log(`  ❌ Negative closing balances: ${entry.closing_fulls} fulls, ${entry.closing_empties} empties`);
        
        // Recalculate with correct formula
        const expectedClosingFulls = entry.opening_fulls + entry.delivered_qty - entry.collected_empties_qty;
        const expectedClosingEmpties = entry.opening_empties + entry.collected_empties_qty - entry.delivered_qty;
        
        // Ensure non-negative values
        updates.closing_fulls = Math.max(0, expectedClosingFulls);
        updates.closing_empties = Math.max(0, expectedClosingEmpties);
        
        console.log(`  ✅ Fixed to: ${updates.closing_fulls} fulls, ${updates.closing_empties} empties`);
        needsUpdate = true;
        issuesFound++;
      }
      
      // Issue 2: Fix data source - get actual delivered/collected from orders
      const orderData = await client.query(
        `SELECT 
          COALESCE(SUM(CASE WHEN o.status IN ('completed', 'delivered') AND oi.is_full = true THEN oi.quantity ELSE 0 END), 0) AS actual_delivered_qty,
          COALESCE(SUM(CASE WHEN o.status IN ('completed', 'delivered') AND oi.is_full = false THEN oi.quantity ELSE 0 END), 0) AS actual_collected_qty,
          COALESCE(SUM(CASE WHEN o.status IN ('pending', 'processing') THEN oi.quantity ELSE 0 END), 0) AS actual_soft_blocked_qty
         FROM orders o
         JOIN order_items oi ON o.order_id = oi.order_id
         WHERE o.delivery_date = $1 
           AND oi.cylinder_type_id = $2 
           AND o.distributor_id = $3`,
        [entry.date, entry.cylinder_type_id, distributorId]
      );
      
      const actualDelivered = Number(orderData.rows[0]?.actual_delivered_qty || 0);
      const actualCollected = Number(orderData.rows[0]?.actual_collected_qty || 0);
      const actualSoftBlocked = Number(orderData.rows[0]?.actual_soft_blocked_qty || 0);
      
      // Check if manual data differs from order data
      if (entry.delivered_qty !== actualDelivered || entry.collected_empties_qty !== actualCollected || entry.soft_blocked_qty !== actualSoftBlocked) {
        console.log(`  ❌ Data source mismatch:`);
        console.log(`    Delivered: DB=${entry.delivered_qty}, Orders=${actualDelivered}`);
        console.log(`    Collected: DB=${entry.collected_empties_qty}, Orders=${actualCollected}`);
        console.log(`    Soft Blocked: DB=${entry.soft_blocked_qty}, Orders=${actualSoftBlocked}`);
        
        updates.delivered_qty = actualDelivered;
        updates.collected_empties_qty = actualCollected;
        updates.soft_blocked_qty = actualSoftBlocked;
        
        // Recalculate closing balances with correct data
        const newClosingFulls = entry.opening_fulls + actualDelivered - actualCollected;
        const newClosingEmpties = entry.opening_empties + actualCollected - actualDelivered;
        
        updates.closing_fulls = Math.max(0, newClosingFulls);
        updates.closing_empties = Math.max(0, newClosingEmpties);
        
        console.log(`  ✅ Updated with order data and recalculated closing balances`);
        needsUpdate = true;
        issuesFound++;
      }
      
      // Issue 3: Fix carry-forward for consecutive dates
      if (entry.date !== allEntries.rows[0].date) { // Not the first date
        const previousEntry = allEntries.rows.find(e => 
          e.date < entry.date && 
          e.cylinder_type_id === entry.cylinder_type_id &&
          e.date === new Date(entry.date).setDate(new Date(entry.date).getDate() - 1)
        );
        
        if (previousEntry && (entry.opening_fulls !== previousEntry.closing_fulls || entry.opening_empties !== previousEntry.closing_empties)) {
          console.log(`  ❌ Carry-forward mismatch:`);
          console.log(`    Previous closing: ${previousEntry.closing_fulls} fulls, ${previousEntry.closing_empties} empties`);
          console.log(`    Current opening: ${entry.opening_fulls} fulls, ${entry.opening_empties} empties`);
          
          updates.opening_fulls = previousEntry.closing_fulls;
          updates.opening_empties = previousEntry.closing_empties;
          
          console.log(`  ✅ Fixed carry-forward`);
          needsUpdate = true;
          issuesFound++;
        }
      }
      
      // Issue 4: Fix status consistency
      if (entry.status !== 'calculated' && entry.status !== 'pending') {
        console.log(`  ❌ Inconsistent status: ${entry.status}`);
        updates.status = 'calculated';
        console.log(`  ✅ Set status to 'calculated'`);
        needsUpdate = true;
        issuesFound++;
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        const updateFields = Object.keys(updates).map((key, index) => `${key} = $${index + 2}`).join(', ');
        const updateValues = Object.values(updates);
        
        await client.query(
          `UPDATE inventory_daily_summary 
           SET ${updateFields}
           WHERE id = $1`,
          [entry.id, ...updateValues]
        );
        
        fixedCount++;
      } else {
        console.log(`  ✅ No issues found`);
      }
    }
    
    // Step 3: Summary
    console.log(`\n📋 SUMMARY:`);
    console.log('-'.repeat(30));
    console.log(`Total entries analyzed: ${allEntries.rows.length}`);
    console.log(`Issues found: ${issuesFound}`);
    console.log(`Entries fixed: ${fixedCount}`);
    
    if (fixedCount > 0) {
      console.log(`\n✅ Successfully fixed ${fixedCount} entries!`);
      
      // Step 4: Verify fixes
      console.log(`\n🔍 Verifying fixes...`);
      const verificationResult = await client.query(
        `SELECT 
          COUNT(*) as total_entries,
          COUNT(CASE WHEN closing_fulls < 0 OR closing_empties < 0 THEN 1 END) as negative_balances,
          COUNT(CASE WHEN status NOT IN ('calculated', 'pending') THEN 1 END) as wrong_status
         FROM inventory_daily_summary 
         WHERE distributor_id = $1`,
        [distributorId]
      );
      
      const { total_entries, negative_balances, wrong_status } = verificationResult.rows[0];
      console.log(`  Total entries: ${total_entries}`);
      console.log(`  Negative balances: ${negative_balances}`);
      console.log(`  Wrong status: ${wrong_status}`);
      
      if (negative_balances === 0 && wrong_status === 0) {
        console.log(`\n🎉 All issues resolved!`);
      } else {
        console.log(`\n⚠️ Some issues remain - manual review needed`);
      }
    } else {
      console.log(`\n✅ No issues found - inventory data is correct!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing inventory issues:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the fix
fixAllInventoryIssues()
  .then(() => {
    console.log('\n✅ Inventory fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Inventory fix failed:', error);
    process.exit(1);
  }); 
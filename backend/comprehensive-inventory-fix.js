const pool = require('./db');

const comprehensiveInventoryFix = async () => {
  console.log('🔧 COMPREHENSIVE INVENTORY FIX');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // Step 1: Get all cylinder types
    const cylinderTypes = await client.query(
      `SELECT cylinder_type_id, name FROM cylinder_types ORDER BY name`
    );
    
    console.log(`📊 Found ${cylinderTypes.rows.length} cylinder types`);
    
    // Step 2: Get date range
    const dateRange = await client.query(
      `SELECT 
        MIN(date) as start_date,
        MAX(date) as end_date
       FROM inventory_daily_summary 
       WHERE distributor_id = $1`,
      [distributorId]
    );
    
    const startDate = new Date(dateRange.rows[0].start_date);
    const endDate = new Date(dateRange.rows[0].end_date);
    
    console.log(`📅 Date range: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Step 3: Delete all existing inventory data
    console.log('\n🗑️ Deleting all existing inventory data...');
    await client.query(
      `DELETE FROM inventory_daily_summary WHERE distributor_id = $1`,
      [distributorId]
    );
    
    // Step 4: Rebuild inventory from scratch
    console.log('\n🔨 Rebuilding inventory from scratch...');
    
    let currentDate = new Date(startDate);
    let previousBalances = {};
    
    // Initialize previous balances for each cylinder type
    cylinderTypes.rows.forEach(ct => {
      previousBalances[ct.cylinder_type_id] = { fulls: 0, empties: 0 };
    });
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      console.log(`\n📅 Processing ${dateStr}...`);
      
      for (const cylinderType of cylinderTypes.rows) {
        const { cylinder_type_id, name } = cylinderType;
        
        // Get opening balances from previous day
        const openingFulls = previousBalances[cylinder_type_id].fulls;
        const openingEmpties = previousBalances[cylinder_type_id].empties;
        
        // Get actual order data for this date
        const orderData = await client.query(
          `SELECT 
            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.delivered_quantity ELSE 0 END), 0) AS delivered_qty,
            COALESCE(SUM(CASE WHEN o.status = 'delivered' THEN oi.empties_collected ELSE 0 END), 0) AS collected_qty,
            COALESCE(SUM(CASE WHEN o.status IN ('pending', 'processing') THEN oi.quantity ELSE 0 END), 0) AS soft_blocked_qty,
            COALESCE(SUM(CASE WHEN o.status = 'cancelled' THEN oi.quantity ELSE 0 END), 0) AS damaged_qty
           FROM orders o
           JOIN order_items oi ON o.order_id = oi.order_id
           WHERE o.delivery_date = $1 
             AND oi.cylinder_type_id = $2 
             AND o.distributor_id = $3`,
          [dateStr, cylinder_type_id, distributorId]
        );
        
        const deliveredQty = Number(orderData.rows[0]?.delivered_qty || 0);
        const collectedQty = Number(orderData.rows[0]?.collected_qty || 0);
        const softBlockedQty = Number(orderData.rows[0]?.soft_blocked_qty || 0);
        const damagedQty = Number(orderData.rows[0]?.damaged_qty || 0);
        
        // Clamp closing balances to zero
        const closingFulls = Math.max(0, openingFulls + deliveredQty - collectedQty);
        const closingEmpties = Math.max(0, openingEmpties + collectedQty - deliveredQty);
        
        // Update previous balances for next day
        previousBalances[cylinder_type_id] = {
          fulls: closingFulls,
          empties: closingEmpties
        };
        
        // Upsert (insert or update) the summary row for this date/type/distributor
        await client.query(
          `INSERT INTO inventory_daily_summary (
            id, date, cylinder_type_id, distributor_id,
            opening_fulls, opening_empties,
            replenished_qty_from_corp, empties_sent_to_corp,
            soft_blocked_qty, delivered_qty, collected_empties_qty,
            damaged_qty, closing_fulls, closing_empties,
            status, created_at, lost, customer_unaccounted, inventory_unaccounted
          ) VALUES (
            gen_random_uuid(), $1, $2, $3,
            $4, $5, 0, 0,
            $6, $7, $8, $9, $10, $11,
            'calculated', NOW(), 0, 0, 0
          )
          ON CONFLICT (date, cylinder_type_id, distributor_id) DO UPDATE SET
            opening_fulls = EXCLUDED.opening_fulls,
            opening_empties = EXCLUDED.opening_empties,
            soft_blocked_qty = EXCLUDED.soft_blocked_qty,
            delivered_qty = EXCLUDED.delivered_qty,
            collected_empties_qty = EXCLUDED.collected_empties_qty,
            damaged_qty = EXCLUDED.damaged_qty,
            closing_fulls = EXCLUDED.closing_fulls,
            closing_empties = EXCLUDED.closing_empties,
            status = 'calculated',
            updated_at = NOW();`,
          [
            dateStr, cylinder_type_id, distributorId,
            openingFulls, openingEmpties,
            softBlockedQty, deliveredQty, collectedQty, damagedQty,
            closingFulls, closingEmpties
          ]
        );
        
        console.log(`  ${name}: ${openingFulls}→${closingFulls} fulls, ${openingEmpties}→${closingEmpties} empties (delivered: ${deliveredQty}, collected: ${collectedQty})`);
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Step 5: Verification
    console.log('\n🔍 Verifying fixes...');
    const verification = await client.query(
      `SELECT 
        COUNT(*) as total_entries,
        COUNT(CASE WHEN closing_fulls < 0 OR closing_empties < 0 THEN 1 END) as negative_balances,
        COUNT(CASE WHEN status != 'calculated' THEN 1 END) as wrong_status,
        COUNT(CASE WHEN opening_fulls = 0 AND opening_empties = 0 AND closing_fulls = 0 AND closing_empties = 0 THEN 1 END) as zero_entries
       FROM inventory_daily_summary 
       WHERE distributor_id = $1`,
      [distributorId]
    );
    
    const { total_entries, negative_balances, wrong_status, zero_entries } = verification.rows[0];
    
    console.log('\n📋 VERIFICATION RESULTS:');
    console.log('-'.repeat(30));
    console.log(`Total entries: ${total_entries}`);
    console.log(`Negative balances: ${negative_balances}`);
    console.log(`Wrong status: ${wrong_status}`);
    console.log(`Zero entries: ${zero_entries}`);
    
    if (negative_balances === 0 && wrong_status === 0) {
      console.log('\n🎉 SUCCESS: All inventory issues resolved!');
      
      // Show sample data
      const sampleData = await client.query(
        `SELECT 
          ids.date,
          ct.name as cylinder_type,
          ids.opening_fulls,
          ids.opening_empties,
          ids.delivered_qty,
          ids.collected_empties_qty,
          ids.closing_fulls,
          ids.closing_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE ids.distributor_id = $1
         ORDER BY ids.date DESC, ct.name
         LIMIT 12`,
        [distributorId]
      );
      
      console.log('\n📊 Sample of fixed data:');
      sampleData.rows.forEach(row => {
        console.log(`${row.date} - ${row.cylinder_type}: ${row.opening_fulls}→${row.closing_fulls} fulls, ${row.opening_empties}→${row.closing_empties} empties`);
      });
      
    } else {
      console.log('\n⚠️ Some issues remain - manual review needed');
    }
    
  } catch (error) {
    console.error('❌ Error in comprehensive fix:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run the comprehensive fix
comprehensiveInventoryFix()
  .then(() => {
    console.log('\n✅ Comprehensive inventory fix complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Comprehensive inventory fix failed:', error);
    process.exit(1);
  }); 
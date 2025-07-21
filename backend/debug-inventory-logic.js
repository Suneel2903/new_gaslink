const pool = require('./db');

const debugInventoryLogic = async () => {
  console.log('🔍 Debugging Inventory Logic Issues');
  console.log('=' .repeat(50));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // 1. Check if the data is actually being calculated correctly
    console.log('\n📊 1. Checking Data Calculation Logic:');
    console.log('-'.repeat(40));
    
    // Get a sample date to check calculations
    const sampleDate = '2025-07-10';
    
    // Get inventory data for this date
    const inventoryData = await client.query(
      `SELECT ct.name, 
              ids.opening_fulls, ids.opening_empties,
              ids.closing_fulls, ids.closing_empties,
              ids.soft_blocked_qty, ids.cancelled_stock,
              ids.delivered_qty, ids.collected_qty
       FROM inventory_daily_summary ids
       JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
       WHERE ids.date = $1 AND ids.distributor_id = $2
       ORDER BY ct.name`,
      [sampleDate, distributorId]
    );
    
    console.log(`📅 Sample date: ${sampleDate}`);
    inventoryData.rows.forEach(row => {
      console.log(`\n${row.name}:`);
      console.log(`  Opening: ${row.opening_fulls} fulls, ${row.opening_empties} empties`);
      console.log(`  Closing: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
      console.log(`  Soft Blocked: ${row.soft_blocked_qty}`);
      console.log(`  Cancelled: ${row.cancelled_stock}`);
      console.log(`  Delivered: ${row.delivered_qty}`);
      console.log(`  Collected: ${row.collected_qty}`);
      
      // Check if closing = opening + delivered - collected
      const expectedClosingFulls = row.opening_fulls + row.delivered_qty - row.collected_qty;
      const expectedClosingEmpties = row.opening_empties + row.collected_qty - row.delivered_qty;
      
      if (row.closing_fulls !== expectedClosingFulls || row.closing_empties !== expectedClosingEmpties) {
        console.log(`  ❌ CALCULATION ERROR:`);
        console.log(`     Expected closing: ${expectedClosingFulls} fulls, ${expectedClosingEmpties} empties`);
        console.log(`     Actual closing: ${row.closing_fulls} fulls, ${row.closing_empties} empties`);
      } else {
        console.log(`  ✅ Calculations correct`);
      }
    });
    
    // 2. Check if the data source is correct
    console.log('\n📊 2. Checking Data Sources:');
    console.log('-'.repeat(40));
    
    // Check orders for the sample date
    const ordersData = await client.query(
      `SELECT 
        o.order_id,
        o.status,
        oi.cylinder_type_id,
        ct.name as cylinder_type,
        oi.quantity,
        oi.is_full
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       JOIN cylinder_types ct ON oi.cylinder_type_id = ct.cylinder_type_id
       WHERE o.distributor_id = $1 
         AND DATE(o.created_at) = $2
       ORDER BY o.status, ct.name`,
      [distributorId, sampleDate]
    );
    
    console.log(`📦 Orders for ${sampleDate}:`);
    if (ordersData.rows.length === 0) {
      console.log('  No orders found for this date');
    } else {
      ordersData.rows.forEach(order => {
        console.log(`  Order ${order.order_id} (${order.status}): ${order.quantity} ${order.is_full ? 'full' : 'empty'} ${order.cylinder_type}`);
      });
    }
    
    // 3. Check if the inventory population logic is working
    console.log('\n📊 3. Checking Inventory Population Logic:');
    console.log('-'.repeat(40));
    
    // Check what the system should calculate vs what it actually calculated
    const { ensureDailyInventoryExists } = require('./services/inventoryPopulationService');
    
    console.log('🔄 Running inventory population for sample date...');
    const populationResult = await ensureDailyInventoryExists(sampleDate, distributorId);
    console.log('Population result:', populationResult);
    
    // 4. Check if the issue is in the UI calculation
    console.log('\n📊 4. Checking UI Calculation Logic:');
    console.log('-'.repeat(40));
    
    // Simulate what the UI might be calculating
    const uiCalculation = await client.query(
      `SELECT 
        ct.name,
        SUM(CASE WHEN oi.is_full = true THEN oi.quantity ELSE 0 END) as full_cylinders,
        SUM(CASE WHEN oi.is_full = false THEN oi.quantity ELSE 0 END) as empty_cylinders,
        COUNT(CASE WHEN o.status IN ('pending', 'processing') THEN 1 END) as soft_blocked_orders
       FROM cylinder_types ct
       LEFT JOIN order_items oi ON ct.cylinder_type_id = oi.cylinder_type_id
       LEFT JOIN orders o ON oi.order_id = o.order_id 
         AND o.distributor_id = $1 
         AND DATE(o.created_at) = $2
       WHERE ct.is_active = true
       GROUP BY ct.cylinder_type_id, ct.name
       ORDER BY ct.name`,
      [distributorId, sampleDate]
    );
    
    console.log(`📱 UI Calculation for ${sampleDate}:`);
    uiCalculation.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.full_cylinders} fulls, ${row.empty_cylinders} empties, ${row.soft_blocked_orders} soft blocked`);
    });
    
    // 5. Compare database vs UI calculations
    console.log('\n📊 5. Database vs UI Comparison:');
    console.log('-'.repeat(40));
    
    inventoryData.rows.forEach((dbRow, i) => {
      const uiRow = uiCalculation.rows[i];
      if (uiRow) {
        console.log(`\n${dbRow.name}:`);
        console.log(`  DB - Opening: ${dbRow.opening_fulls},${dbRow.opening_empties} | Closing: ${dbRow.closing_fulls},${dbRow.closing_empties}`);
        console.log(`  UI - Fulls: ${uiRow.full_cylinders} | Empties: ${uiRow.empty_cylinders} | Soft Blocked: ${uiRow.soft_blocked_orders}`);
        
        if (dbRow.closing_fulls !== uiRow.full_cylinders || dbRow.closing_empties !== uiRow.empty_cylinders) {
          console.log(`  ❌ MISMATCH: Database and UI calculations differ`);
        } else {
          console.log(`  ✅ MATCH: Database and UI calculations agree`);
        }
      }
    });
    
    console.log('\n🎯 Debug Summary:');
    console.log('-'.repeat(20));
    console.log('Check the above output to identify:');
    console.log('1. If calculations are mathematically correct');
    console.log('2. If data sources are providing expected values');
    console.log('3. If inventory population is working correctly');
    console.log('4. If UI and database calculations match');
    console.log('5. If there are any logical errors in the system');
    
  } catch (error) {
    console.error('❌ Error debugging inventory logic:', error);
  } finally {
    client.release();
  }
};

// Run the debug
debugInventoryLogic()
  .then(() => {
    console.log('\n✅ Debug complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Debug failed:', error);
    process.exit(1);
  }); 
console.log('Testing minimal vehicle controller...');

try {
  // Test 1: Import database
  console.log('1. Testing database import...');
  const pool = require('./db');
  console.log('✅ Database imported');
  
  // Test 2: Import controller
  console.log('2. Testing controller import...');
  const controller = require('./controllers/vehicleController');
  console.log('✅ Controller imported');
  console.log('Controller keys:', Object.keys(controller));
  
  // Test 3: Check each function
  console.log('3. Testing functions...');
  console.log('getCancelledStockInVehicles:', typeof controller.getCancelledStockInVehicles);
  console.log('moveCancelledStockToInventory:', typeof controller.moveCancelledStockToInventory);
  console.log('getVehicleInventorySummary:', typeof controller.getVehicleInventorySummary);
  
  // Test 4: Check if they're undefined
  if (controller.getCancelledStockInVehicles === undefined) {
    console.log('❌ getCancelledStockInVehicles is undefined');
  } else {
    console.log('✅ getCancelledStockInVehicles is defined');
  }
  
  if (controller.moveCancelledStockToInventory === undefined) {
    console.log('❌ moveCancelledStockToInventory is undefined');
  } else {
    console.log('✅ moveCancelledStockToInventory is defined');
  }
  
  if (controller.getVehicleInventorySummary === undefined) {
    console.log('❌ getVehicleInventorySummary is undefined');
  } else {
    console.log('✅ getVehicleInventorySummary is defined');
  }
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
} 
// Test vehicle controller exports
console.log('Testing vehicle controller exports...');

try {
  const vehicleController = require('./controllers/vehicleController');
  console.log('✅ Vehicle controller imported successfully');
  console.log('Available functions:', Object.keys(vehicleController));
  
  // Check if all required functions exist
  const requiredFunctions = [
    'getCancelledStockInVehicles',
    'moveCancelledStockToInventory', 
    'getVehicleInventorySummary'
  ];
  
  for (const funcName of requiredFunctions) {
    if (typeof vehicleController[funcName] === 'function') {
      console.log(`✅ ${funcName} is a function`);
    } else {
      console.log(`❌ ${funcName} is NOT a function:`, typeof vehicleController[funcName]);
    }
  }
  
} catch (error) {
  console.error('❌ Error importing vehicle controller:', error);
} 
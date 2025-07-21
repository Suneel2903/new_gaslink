console.log('Testing vehicle controller import...');

try {
  // Test database connection first
  console.log('1. Testing database connection...');
  const pool = require('./db');
  console.log('✅ Database pool imported successfully');
  
  // Test vehicle controller import
  console.log('2. Testing vehicle controller import...');
  const vehicleController = require('./controllers/vehicleController');
  console.log('✅ Vehicle controller imported successfully');
  console.log('Available functions:', Object.keys(vehicleController));
  
  // Test if functions are actually functions
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
  
  // Test database query
  console.log('3. Testing database query...');
  const result = await pool.query('SELECT 1 as test');
  console.log('✅ Database query successful:', result.rows);
  
} catch (error) {
  console.error('❌ Error:', error.message);
  console.error('Stack:', error.stack);
} 
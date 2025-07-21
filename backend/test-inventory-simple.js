const { ensureDailyInventoryExists } = require('./services/inventoryPopulationService');
const { fillInventoryGaps, detectInventoryGaps } = require('./services/gapRecoveryService');
const { runDailyInventoryCron } = require('./cron/dailyInventoryCron');
const { runGapRecoveryCron } = require('./cron/gapRecoveryCron');

/**
 * Simplified test script for Inventory Continuity System
 */
const testInventoryContinuity = async () => {
  console.log('🧪 Testing Inventory Continuity System (Simplified)');
  console.log('=' .repeat(50));
  
  const testDistributorId = '11111111-1111-1111-1111-111111111111';
  const testDate = new Date().toISOString().split('T')[0]; // Today's date
  
  try {
    // Test 1: Ensure daily inventory exists
    console.log('\n📋 Test 1: ensureDailyInventoryExists()');
    console.log('-'.repeat(30));
    
    const dailyResult = await ensureDailyInventoryExists(testDate, testDistributorId);
    console.log('✅ Daily inventory result:', dailyResult);
    
    // Test 2: Detect gaps
    console.log('\n📋 Test 2: detectInventoryGaps()');
    console.log('-'.repeat(30));
    
    const gapDetection = await detectInventoryGaps(testDistributorId, 10);
    console.log('✅ Gap detection result:', gapDetection);
    
    // Test 3: Fill gaps for last 5 days
    console.log('\n📋 Test 3: fillInventoryGaps()');
    console.log('-'.repeat(30));
    
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (5 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    const gapFilling = await fillInventoryGaps(startDate, endDate, testDistributorId);
    console.log('✅ Gap filling result:', gapFilling);
    
    // Test 4: Daily inventory cron (manual run)
    console.log('\n📋 Test 4: Daily Inventory Cron (Manual)');
    console.log('-'.repeat(30));
    
    const dailyCronResult = await runDailyInventoryCron();
    console.log('✅ Daily cron result:', dailyCronResult);
    
    // Test 5: Gap recovery cron (manual run)
    console.log('\n📋 Test 5: Gap Recovery Cron (Manual)');
    console.log('-'.repeat(30));
    
    const gapCronResult = await runGapRecoveryCron();
    console.log('✅ Gap cron result:', gapCronResult);
    
    console.log('\n🎯 All tests completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  testInventoryContinuity()
    .then(() => {
      console.log('✅ All tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Tests failed:', error);
      process.exit(1);
    });
}

module.exports = {
  testInventoryContinuity
}; 
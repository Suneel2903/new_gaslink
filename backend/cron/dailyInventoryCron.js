const pool = require('../db');
const { ensureDailyInventoryExists } = require('../services/inventoryPopulationService');

/**
 * Daily inventory population cron job
 * Runs at 00:01 every day
 * Ensures inventory entries exist for all distributors
 */
const dailyInventoryCron = async () => {
  console.log('🚀 Starting daily inventory population cron job');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  const client = await pool.connect();
  
  try {
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    console.log(`📅 Processing inventory for date: ${today}`);
    
    // For now, use the test distributor ID since distributors table might not exist
    const distributors = [
      { distributor_id: '11111111-1111-1111-1111-111111111111', name: 'Test Distributor' }
    ];
    
    console.log(`🏢 Processing ${distributors.length} distributors`);
    
    // Process each distributor
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const distributor of distributors) {
      try {
        console.log(`🔄 Processing distributor: ${distributor.name} (${distributor.distributor_id})`);
        
        const result = await ensureDailyInventoryExists(today, distributor.distributor_id);
        results.push({
          distributor_id: distributor.distributor_id,
          distributor_name: distributor.name,
          ...result
        });
        
        if (result.success) {
          successCount++;
          console.log(`✅ Successfully processed ${distributor.name}`);
        } else {
          errorCount++;
          console.log(`❌ Failed to process ${distributor.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing distributor ${distributor.name}:`, error.message);
        results.push({
          distributor_id: distributor.distributor_id,
          distributor_name: distributor.name,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }
    
    const summary = {
      date: today,
      distributors_processed: distributors.length,
      success_count: successCount,
      error_count: errorCount,
      success: errorCount === 0,
      results,
      message: `Processed ${distributors.length} distributors: ${successCount} success, ${errorCount} errors`
    };
    
    console.log('🎯 Daily inventory cron job complete:', summary);
    
    return summary;
    
  } catch (error) {
    console.error('❌ Critical error in daily inventory cron:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Manual trigger for testing
 */
const runDailyInventoryCron = async () => {
  try {
    console.log('🧪 Manually running daily inventory cron job');
    const result = await dailyInventoryCron();
    console.log('✅ Manual run complete:', result);
    return result;
  } catch (error) {
    console.error('❌ Manual run failed:', error);
    throw error;
  }
};

// Export for both cron and manual execution
module.exports = {
  dailyInventoryCron,
  runDailyInventoryCron
};

// If this file is run directly, execute the cron job
if (require.main === module) {
  runDailyInventoryCron()
    .then(() => {
      console.log('✅ Cron job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cron job failed:', error);
      process.exit(1);
    });
} 
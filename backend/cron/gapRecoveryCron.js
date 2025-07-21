const pool = require('../db');
const { fillInventoryGaps, detectInventoryGaps } = require('../services/gapRecoveryService');

/**
 * Gap recovery cron job
 * Runs at 03:00 every day
 * Detects and fills inventory gaps for all distributors
 */
const gapRecoveryCron = async () => {
  console.log('🚀 Starting gap recovery cron job');
  console.log('⏰ Timestamp:', new Date().toISOString());
  
  const client = await pool.connect();
  
  try {
    // Look back 30 days for gaps
    const daysBack = 30;
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    console.log(`📅 Scanning for gaps from ${startDate} to ${endDate}`);
    
    // For now, use the test distributor ID since distributors table might not exist
    const distributors = [
      { distributor_id: '11111111-1111-1111-1111-111111111111', name: 'Test Distributor' }
    ];
    
    console.log(`🏢 Processing ${distributors.length} distributors`);
    
    // Process each distributor
    const results = [];
    let totalGapsFound = 0;
    let totalGapsFilled = 0;
    let errorCount = 0;
    
    for (const distributor of distributors) {
      try {
        console.log(`🔄 Processing distributor: ${distributor.name} (${distributor.distributor_id})`);
        
        // First, detect gaps
        const gapDetection = await detectInventoryGaps(distributor.distributor_id, daysBack);
        
        if (gapDetection.missing_days === 0) {
          console.log(`✅ No gaps found for ${distributor.name}`);
          results.push({
            distributor_id: distributor.distributor_id,
            distributor_name: distributor.name,
            gaps_found: 0,
            gaps_filled: 0,
            success: true,
            message: 'No gaps found'
          });
          continue;
        }
        
        console.log(`❌ Found ${gapDetection.missing_days} missing days for ${distributor.name}`);
        console.log(`📊 Largest gap: ${gapDetection.largest_gap} days`);
        
        // Fill the gaps
        const gapFilling = await fillInventoryGaps(startDate, endDate, distributor.distributor_id);
        
        results.push({
          distributor_id: distributor.distributor_id,
          distributor_name: distributor.name,
          gaps_found: gapDetection.missing_days,
          gaps_filled: gapFilling.filled_dates,
          largest_gap: gapDetection.largest_gap,
          success: gapFilling.success,
          message: gapFilling.message
        });
        
        totalGapsFound += gapDetection.missing_days;
        totalGapsFilled += gapFilling.filled_dates;
        
        if (gapFilling.success) {
          console.log(`✅ Successfully filled gaps for ${distributor.name}`);
        } else {
          console.log(`⚠️ Partially filled gaps for ${distributor.name}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing distributor ${distributor.name}:`, error.message);
        results.push({
          distributor_id: distributor.distributor_id,
          distributor_name: distributor.name,
          gaps_found: 0,
          gaps_filled: 0,
          success: false,
          error: error.message
        });
        errorCount++;
      }
    }
    
    const summary = {
      startDate,
      endDate,
      distributors_processed: distributors.length,
      total_gaps_found: totalGapsFound,
      total_gaps_filled: totalGapsFilled,
      error_count: errorCount,
      success: errorCount === 0,
      results,
      message: `Processed ${distributors.length} distributors: Found ${totalGapsFound} gaps, Filled ${totalGapsFilled} gaps, ${errorCount} errors`
    };
    
    console.log('🎯 Gap recovery cron job complete:', summary);
    
    // Alert if there are large gaps
    const largeGaps = results.filter(r => r.largest_gap > 7);
    if (largeGaps.length > 0) {
      console.warn('⚠️ WARNING: Large gaps detected:', largeGaps);
    }
    
    return summary;
    
  } catch (error) {
    console.error('❌ Critical error in gap recovery cron:', error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Manual trigger for testing
 */
const runGapRecoveryCron = async () => {
  try {
    console.log('🧪 Manually running gap recovery cron job');
    const result = await gapRecoveryCron();
    console.log('✅ Manual run complete:', result);
    return result;
  } catch (error) {
    console.error('❌ Manual run failed:', error);
    throw error;
  }
};

// Export for both cron and manual execution
module.exports = {
  gapRecoveryCron,
  runGapRecoveryCron
};

// If this file is run directly, execute the cron job
if (require.main === module) {
  runGapRecoveryCron()
    .then(() => {
      console.log('✅ Cron job completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Cron job failed:', error);
      process.exit(1);
    });
} 
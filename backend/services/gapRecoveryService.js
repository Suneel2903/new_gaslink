const pool = require('../db');
const { ensureDailyInventoryExists } = require('./inventoryPopulationService');

/**
 * Fill missing inventory entries for date range
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {string} distributor_id - Distributor UUID
 * @returns {Promise<Object>} - Gap filling summary
 */
const fillInventoryGaps = async (startDate, endDate, distributor_id) => {
  const client = await pool.connect();
  
  try {
    console.log(`🔍 Filling inventory gaps from ${startDate} to ${endDate} for distributor: ${distributor_id}`);
    
    // Generate date series
    const dateSeriesResult = await client.query(
      `SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS date`,
      [startDate, endDate]
    );
    
    const dateSeries = dateSeriesResult.rows.map(row => row.date);
    console.log(`📅 Processing ${dateSeries.length} dates`);
    
    // Find existing dates for this distributor
    const existingDatesResult = await client.query(
      `SELECT DISTINCT date 
       FROM inventory_daily_summary 
       WHERE distributor_id = $1 AND date BETWEEN $2 AND $3`,
      [distributor_id, startDate, endDate]
    );
    
    const existingDates = new Set(existingDatesResult.rows.map(row => row.date));
    console.log(`✅ Found ${existingDates.size} existing dates`);
    
    // Find missing dates
    const missingDates = dateSeries.filter(date => !existingDates.has(date));
    console.log(`❌ Found ${missingDates.length} missing dates:`, missingDates);
    
    if (missingDates.length === 0) {
      return {
        startDate,
        endDate,
        distributor_id,
        total_dates: dateSeries.length,
        existing_dates: existingDates.size,
        missing_dates: 0,
        filled_dates: 0,
        success: true,
        message: 'No gaps found'
      };
    }
    
    // Fill each missing date
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const date of missingDates) {
      try {
        console.log(`🔄 Filling gap for ${date}`);
        const result = await ensureDailyInventoryExists(date, distributor_id);
        results.push({ date, ...result });
        successCount++;
        console.log(`✅ Gap filled for ${date}`);
      } catch (error) {
        console.error(`❌ Error filling gap for ${date}:`, error.message);
        results.push({ date, success: false, error: error.message });
        errorCount++;
      }
    }
    
    const summary = {
      startDate,
      endDate,
      distributor_id,
      total_dates: dateSeries.length,
      existing_dates: existingDates.size,
      missing_dates: missingDates.length,
      filled_dates: successCount,
      error_dates: errorCount,
      success: errorCount === 0,
      results,
      message: `Filled ${successCount} gaps, ${errorCount} errors`
    };
    
    console.log(`🎯 Gap filling complete:`, summary);
    return summary;
    
  } catch (error) {
    console.error(`❌ Error in gap recovery:`, error);
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Detect gaps in inventory data for a distributor
 * @param {string} distributor_id - Distributor UUID
 * @param {number} daysBack - Number of days to look back (default: 30)
 * @returns {Promise<Object>} - Gap detection summary
 */
const detectInventoryGaps = async (distributor_id, daysBack = 30) => {
  const client = await pool.connect();
  
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
    
    console.log(`🔍 Detecting gaps from ${startDate} to ${endDate} for distributor: ${distributor_id}`);
    
    // Get all dates in range
    const dateSeriesResult = await client.query(
      `SELECT generate_series($1::date, $2::date, '1 day'::interval)::date AS date`,
      [startDate, endDate]
    );
    
    const dateSeries = dateSeriesResult.rows.map(row => row.date);
    
    // Get existing dates
    const existingDatesResult = await client.query(
      `SELECT DISTINCT date 
       FROM inventory_daily_summary 
       WHERE distributor_id = $1 AND date BETWEEN $2 AND $3`,
      [distributor_id, startDate, endDate]
    );
    
    const existingDates = new Set(existingDatesResult.rows.map(row => row.date));
    const missingDates = dateSeries.filter(date => !existingDates.has(date));
    
    // Group consecutive missing dates
    const gaps = [];
    let currentGap = [];
    
    for (const date of missingDates) {
      if (currentGap.length === 0 || 
          new Date(date) - new Date(currentGap[currentGap.length - 1]) === 24 * 60 * 60 * 1000) {
        currentGap.push(date);
      } else {
        if (currentGap.length > 0) {
          gaps.push({
            start: currentGap[0],
            end: currentGap[currentGap.length - 1],
            days: currentGap.length,
            dates: [...currentGap]
          });
        }
        currentGap = [date];
      }
    }
    
    // Add the last gap
    if (currentGap.length > 0) {
      gaps.push({
        start: currentGap[0],
        end: currentGap[currentGap.length - 1],
        days: currentGap.length,
        dates: [...currentGap]
      });
    }
    
    const summary = {
      distributor_id,
      startDate,
      endDate,
      total_days: dateSeries.length,
      existing_days: existingDates.size,
      missing_days: missingDates.length,
      gaps: gaps,
      largest_gap: gaps.length > 0 ? Math.max(...gaps.map(g => g.days)) : 0,
      success: true
    };
    
    console.log(`🎯 Gap detection complete:`, summary);
    return summary;
    
  } catch (error) {
    console.error(`❌ Error detecting gaps:`, error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  fillInventoryGaps,
  detectInventoryGaps
}; 
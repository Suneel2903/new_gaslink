const pool = require('./db');

const quickDataCheck = async () => {
  console.log('🔍 Quick Inventory Data Check');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  const distributorId = '11111111-1111-1111-1111-111111111111';
  
  try {
    // Get basic stats
    const stats = await client.query(
      `SELECT COUNT(*) as total_rows, 
              COUNT(DISTINCT date) as dates,
              MIN(date) as earliest,
              MAX(date) as latest
       FROM inventory_daily_summary 
       WHERE distributor_id = $1`,
      [distributorId]
    );
    
    const { total_rows, dates, earliest, latest } = stats.rows[0];
    console.log(`📊 Total rows: ${total_rows}, Dates: ${dates}`);
    console.log(`📅 Range: ${earliest} to ${latest}`);
    
    // Get all dates
    const allDates = await client.query(
      `SELECT DISTINCT date FROM inventory_daily_summary 
       WHERE distributor_id = $1 ORDER BY date`,
      [distributorId]
    );
    
    console.log(`\n📅 All dates (${allDates.rows.length}):`);
    allDates.rows.forEach((row, i) => {
      console.log(`  ${i + 1}. ${row.date}`);
    });
    
    // Check recent data
    console.log('\n📋 Recent data (last 3 dates):');
    const recentDates = allDates.rows.slice(-3);
    
    for (const dateRow of recentDates) {
      const date = dateRow.date;
      console.log(`\n📅 ${date}:`);
      
      const data = await client.query(
        `SELECT ct.name, 
                ids.opening_fulls, ids.opening_empties,
                ids.closing_fulls, ids.closing_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE ids.date = $1 AND ids.distributor_id = $2
         ORDER BY ct.name`,
        [date, distributorId]
      );
      
      data.rows.forEach(row => {
        console.log(`  ${row.name}: O(${row.opening_fulls},${row.opening_empties}) → C(${row.closing_fulls},${row.closing_empties})`);
      });
    }
    
    // Check for gaps
    console.log('\n🕳️ Checking for gaps...');
    let gaps = 0;
    for (let i = 0; i < allDates.rows.length - 1; i++) {
      const current = new Date(allDates.rows[i].date);
      const next = new Date(allDates.rows[i + 1].date);
      const diff = (next - current) / (1000 * 60 * 60 * 24);
      if (diff > 1) {
        console.log(`❌ Gap: ${allDates.rows[i].date} to ${allDates.rows[i + 1].date} (${diff - 1} days missing)`);
        gaps++;
      }
    }
    
    if (gaps === 0) {
      console.log('✅ No date gaps found');
    }
    
    console.log(`\n🎯 Summary: ${total_rows} rows, ${dates} dates, ${gaps} gaps`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
  }
};

quickDataCheck().then(() => process.exit(0)); 
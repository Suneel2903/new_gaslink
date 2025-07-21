const pool = require('./db');

const checkDates = async () => {
  console.log('🔍 Check if July 7-8 data exists');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  
  try {
    // Check what dates exist
    const datesResult = await client.query(
      `SELECT DISTINCT date 
       FROM inventory_daily_summary 
       WHERE distributor_id = '11111111-1111-1111-1111-111111111111'
         AND date BETWEEN '2025-07-01' AND '2025-07-15'
       ORDER BY date`
    );
    
    console.log('Available dates:');
    datesResult.rows.forEach(row => {
      console.log(`  ${row.date}`);
    });
    
    // Check if July 7 and 8 exist
    const july7Exists = await client.query(
      `SELECT COUNT(*) as count FROM inventory_daily_summary 
       WHERE date = '2025-07-07' AND distributor_id = '11111111-1111-1111-1111-111111111111'`
    );
    
    const july8Exists = await client.query(
      `SELECT COUNT(*) as count FROM inventory_daily_summary 
       WHERE date = '2025-07-08' AND distributor_id = '11111111-1111-1111-1111-111111111111'`
    );
    
    console.log(`\nJuly 7 entries: ${july7Exists.rows[0].count}`);
    console.log(`July 8 entries: ${july8Exists.rows[0].count}`);
    
    // If they exist, show the data
    if (july7Exists.rows[0].count > 0) {
      console.log('\nJuly 7 data:');
      const july7Data = await client.query(
        `SELECT ct.name, opening_fulls, opening_empties, closing_fulls, closing_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE date = '2025-07-07' AND distributor_id = '11111111-1111-1111-1111-111111111111'
         ORDER BY ct.name`
      );
      
      july7Data.rows.forEach(row => {
        console.log(`  ${row.name}: Opening(${row.opening_fulls},${row.opening_empties}) Closing(${row.closing_fulls},${row.closing_empties})`);
      });
    }
    
    if (july8Exists.rows[0].count > 0) {
      console.log('\nJuly 8 data:');
      const july8Data = await client.query(
        `SELECT ct.name, opening_fulls, opening_empties, closing_fulls, closing_empties
         FROM inventory_daily_summary ids
         JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
         WHERE date = '2025-07-08' AND distributor_id = '11111111-1111-1111-1111-111111111111'
         ORDER BY ct.name`
      );
      
      july8Data.rows.forEach(row => {
        console.log(`  ${row.name}: Opening(${row.opening_fulls},${row.opening_empties}) Closing(${row.closing_fulls},${row.closing_empties})`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
  }
};

checkDates().then(() => process.exit(0)); 
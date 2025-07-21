const pool = require('./db');

const quickCheck = async () => {
  console.log('🔍 Quick July 7-8 Gap Check');
  console.log('=' .repeat(40));
  
  const client = await pool.connect();
  
  try {
    // Simple check for July 7 and 8
    const result = await client.query(
      `SELECT 
        date,
        ct.name,
        opening_fulls,
        opening_empties,
        closing_fulls,
        closing_empties
      FROM inventory_daily_summary ids
      JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
      WHERE date IN ('2025-07-07', '2025-07-08')
        AND distributor_id = '11111111-1111-1111-1111-111111111111'
      ORDER BY date, ct.name`
    );
    
    console.log('Data found:');
    result.rows.forEach(row => {
      console.log(`${row.date} - ${row.name}: Opening(${row.opening_fulls},${row.opening_empties}) Closing(${row.closing_fulls},${row.closing_empties})`);
    });
    
    // Check if July 8th opening matches July 7th closing
    console.log('\nGap Analysis:');
    const july7 = result.rows.filter(r => r.date === '2025-07-07');
    const july8 = result.rows.filter(r => r.date === '2025-07-08');
    
    july7.forEach((j7, i) => {
      const j8 = july8[i];
      if (j8) {
        const fullsGap = j7.closing_fulls - j8.opening_fulls;
        const emptiesGap = j7.closing_empties - j8.opening_empties;
        
        if (fullsGap !== 0 || emptiesGap !== 0) {
          console.log(`⚠️ ${j7.name} GAP: Fulls(${fullsGap}) Empties(${emptiesGap})`);
        } else {
          console.log(`✅ ${j7.name}: No gap`);
        }
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    client.release();
  }
};

quickCheck().then(() => process.exit(0)); 
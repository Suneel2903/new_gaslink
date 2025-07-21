-- Check inventory data for July 7th and 8th to identify gaps
SELECT 
    date,
    cylinder_type_id,
    ct.name as cylinder_type_name,
    opening_fulls,
    opening_empties,
    ac4_qty,
    erv_qty,
    soft_blocked_qty,
    delivered_qty,
    collected_empties_qty,
    customer_unaccounted,
    inventory_unaccounted,
    closing_fulls,
    closing_empties,
    status
FROM inventory_daily_summary ids
JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
WHERE date IN ('2025-07-07', '2025-07-08')
  AND distributor_id = '11111111-1111-1111-1111-111111111111'
ORDER BY date, ct.name;

-- Check the carry-forward logic - what should opening balances be on July 8th?
SELECT 
    'July 7th Closing' as info,
    ct.name as cylinder_type_name,
    closing_fulls,
    closing_empties
FROM inventory_daily_summary ids
JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
WHERE date = '2025-07-07'
  AND distributor_id = '11111111-1111-1111-1111-111111111111'
ORDER BY ct.name;

SELECT 
    'July 8th Opening' as info,
    ct.name as cylinder_type_name,
    opening_fulls,
    opening_empties
FROM inventory_daily_summary ids
JOIN cylinder_types ct ON ids.cylinder_type_id = ct.cylinder_type_id
WHERE date = '2025-07-08'
  AND distributor_id = '11111111-1111-1111-1111-111111111111'
ORDER BY ct.name;

-- Check if there are any missing entries
SELECT 
    'Missing Dates' as info,
    generate_series('2025-07-07'::date, '2025-07-08'::date, '1 day'::interval)::date AS date
EXCEPT
SELECT DISTINCT date 
FROM inventory_daily_summary 
WHERE distributor_id = '11111111-1111-1111-1111-111111111111'
  AND date BETWEEN '2025-07-07' AND '2025-07-08'
ORDER BY date;

-- Check for any data inconsistencies
SELECT 
    'Data Check' as info,
    COUNT(*) as total_entries,
    COUNT(DISTINCT date) as unique_dates,
    COUNT(DISTINCT cylinder_type_id) as unique_cylinder_types
FROM inventory_daily_summary 
WHERE distributor_id = '11111111-1111-1111-1111-111111111111'
  AND date BETWEEN '2025-07-07' AND '2025-07-08'; 
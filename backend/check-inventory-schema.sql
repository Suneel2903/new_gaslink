-- Check inventory_daily_summary schema
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'inventory_daily_summary'
ORDER BY ordinal_position;

-- Check unique constraints
SELECT *
FROM pg_indexes
WHERE tablename = 'inventory_daily_summary'
  AND indexdef ILIKE '%distributor_id%'
  AND indexdef ILIKE '%cylinder_type_id%'
  AND indexdef ILIKE '%date%';

-- Check cylinder types
SELECT cylinder_type_id, name, is_active
FROM cylinder_types
WHERE is_active = TRUE AND deleted_at IS NULL
ORDER BY name;

-- Check order statuses for soft blocking
SELECT DISTINCT status, COUNT(*) as count
FROM orders
WHERE distributor_id = '11111111-1111-1111-1111-111111111111'
ORDER BY status; 
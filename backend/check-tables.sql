-- Check what tables exist in the database
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Check if distributors table exists and its schema
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'distributors' 
ORDER BY ordinal_position;

-- Check if users table exists (might be the distributors table)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
ORDER BY ordinal_position; 
-- Add missing columns to inventory_daily_summary table
-- These columns are required for the inventory continuity system

-- Add ac4_qty column (AC4 additions)
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS ac4_qty INTEGER DEFAULT 0;

-- Add erv_qty column (ERV removals)
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS erv_qty INTEGER DEFAULT 0;

-- Add soft_blocked_qty column (soft-blocked orders)
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS soft_blocked_qty INTEGER DEFAULT 0;

-- Add customer_unaccounted column
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS customer_unaccounted INTEGER DEFAULT 0;

-- Add inventory_unaccounted column
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS inventory_unaccounted INTEGER DEFAULT 0;

-- Add updated_at column
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Create index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_inventory_daily_summary_date 
ON inventory_daily_summary(date);

-- Create index for better performance on distributor queries
CREATE INDEX IF NOT EXISTS idx_inventory_daily_summary_distributor 
ON inventory_daily_summary(distributor_id);

-- Create composite index for better performance on date + distributor queries
CREATE INDEX IF NOT EXISTS idx_inventory_daily_summary_date_distributor 
ON inventory_daily_summary(date, distributor_id);

-- Verify the changes
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'inventory_daily_summary'
ORDER BY ordinal_position; 
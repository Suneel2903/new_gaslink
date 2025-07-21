-- Add missing columns to inventory_daily_summary table
-- These columns are needed for the auto-save functionality in inventory controller

ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS ac4_qty INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS erv_qty INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS customer_unaccounted INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS inventory_unaccounted INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS lost INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

-- Add index for better performance on date queries
CREATE INDEX IF NOT EXISTS idx_inventory_daily_summary_date_distributor 
ON inventory_daily_summary(date, distributor_id, cylinder_type_id);

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_inventory_daily_summary_status 
ON inventory_daily_summary(status); 
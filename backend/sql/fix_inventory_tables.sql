-- Fix Inventory Tables Migration
-- Add missing columns to inventory_daily_summary and stock_replenishment_requests

-- Add lost column to inventory_daily_summary
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS lost INT NOT NULL DEFAULT 0;

-- Add missing columns to stock_replenishment_requests
ALTER TABLE stock_replenishment_requests 
ADD COLUMN IF NOT EXISTS requested_qty INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_stock INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS threshold_qty INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS date DATE;

-- Update existing records to have default values
UPDATE stock_replenishment_requests 
SET requested_qty = quantity,
    current_stock = 0,
    threshold_qty = 50,
    date = CURRENT_DATE
WHERE requested_qty IS NULL;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_inventory_summary_date_type ON inventory_daily_summary(date, cylinder_type_id);
CREATE INDEX IF NOT EXISTS idx_stock_replenishment_status ON stock_replenishment_requests(status); 
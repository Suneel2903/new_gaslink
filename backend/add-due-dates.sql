-- Add due dates to pending action tables for better business logic

-- 1. Add due_date to credit_notes
ALTER TABLE credit_notes ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 2. Add due_date to invoice_disputes  
ALTER TABLE invoice_disputes ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 3. Add due_date to customer_modification_requests
ALTER TABLE customer_modification_requests ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 4. Add due_date to manual_inventory_adjustments
ALTER TABLE manual_inventory_adjustments ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 5. Add due_date to accountability_logs
ALTER TABLE accountability_logs ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 6. Add due_date to stock_replenishment_requests
ALTER TABLE stock_replenishment_requests ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 7. Add due_date to payment_transactions (for unallocated payments)
ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS due_date TIMESTAMP;

-- 8. Create settings table for configurable due dates
CREATE TABLE IF NOT EXISTS distributor_settings (
  setting_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  distributor_id UUID NOT NULL REFERENCES distributors(distributor_id),
  setting_key VARCHAR(100) NOT NULL,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(distributor_id, setting_key)
);

-- Insert default due date settings for existing distributors
INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_credit_notes',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_invoice_disputes',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_customer_modifications',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_inventory_adjustments',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_accountability_logs',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_stock_replenishment',
  '0'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

INSERT INTO distributor_settings (distributor_id, setting_key, setting_value) 
SELECT 
  distributor_id,
  'due_date_unallocated_payments',
  '2'
FROM distributors 
WHERE deleted_at IS NULL
ON CONFLICT (distributor_id, setting_key) DO NOTHING;

-- Set default due dates based on business logic (2 days for most, immediate for stock replenishment)
-- Credit notes: 2 days from creation
UPDATE credit_notes SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL;

-- Invoice disputes: 2 days from creation  
UPDATE invoice_disputes SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL;

-- Customer modifications: 2 days from creation
UPDATE customer_modification_requests SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL;

-- Manual inventory adjustments: 2 days from creation
UPDATE manual_inventory_adjustments SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL;

-- Accountability logs: 2 days from creation
UPDATE accountability_logs SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL;

-- Stock replenishment: IMMEDIATE (same day) - most critical
UPDATE stock_replenishment_requests SET due_date = created_at WHERE due_date IS NULL;

-- Unallocated payments: 2 days from creation
UPDATE payment_transactions SET due_date = created_at + INTERVAL '2 days' WHERE due_date IS NULL AND allocation_status = 'UNALLOCATED';

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_credit_notes_due_date ON credit_notes(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_disputes_due_date ON invoice_disputes(due_date);
CREATE INDEX IF NOT EXISTS idx_customer_mod_requests_due_date ON customer_modification_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_manual_inventory_adj_due_date ON manual_inventory_adjustments(due_date);
CREATE INDEX IF NOT EXISTS idx_accountability_logs_due_date ON accountability_logs(due_date);
CREATE INDEX IF NOT EXISTS idx_stock_replenishment_due_date ON stock_replenishment_requests(due_date);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_due_date ON payment_transactions(due_date);
CREATE INDEX IF NOT EXISTS idx_distributor_settings_distributor_id ON distributor_settings(distributor_id);
CREATE INDEX IF NOT EXISTS idx_distributor_settings_key ON distributor_settings(setting_key); 
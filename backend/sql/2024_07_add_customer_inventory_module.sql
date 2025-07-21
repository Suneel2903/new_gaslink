-- Add grace period and enable_grace_recovery columns to customers table
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS grace_period_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS enable_grace_recovery BOOLEAN DEFAULT FALSE;

-- Create customer_inventory_override_requests table for audit/override requests
CREATE TABLE IF NOT EXISTS customer_inventory_override_requests (
  request_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('distributor', 'inventory')),
  cylinder_type_id UUID REFERENCES cylinder_types(cylinder_type_id),
  with_customer_qty INTEGER,
  pending_returns INTEGER,
  missing_qty INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT now(),
  approved_by UUID REFERENCES users(user_id),
  approved_at TIMESTAMP
); 
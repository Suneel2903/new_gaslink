-- Add missing columns to inventory_daily_summary for enhanced logic
ALTER TABLE inventory_daily_summary 
ADD COLUMN IF NOT EXISTS soft_blocked_fulls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS delivered_fulls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS damaged_fulls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS with_customers_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_returns_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS missing_qty INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS replenished_fulls INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sent_empties INTEGER DEFAULT 0;

-- Add columns to inventory_daily_summary if not exists
ALTER TABLE inventory_daily_summary
ADD COLUMN IF NOT EXISTS customer_unaccounted INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS inventory_unaccounted INT NOT NULL DEFAULT 0;

-- Create inventory_adjustments table for manual adjustments
CREATE TABLE IF NOT EXISTS inventory_adjustments (
    adjustment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID REFERENCES inventory_daily_summary(id),
    cylinder_type_id UUID REFERENCES cylinder_types(cylinder_type_id),
    distributor_id VARCHAR(255) REFERENCES distributors(distributor_id),
    date DATE NOT NULL,
    adjustment_type VARCHAR(50) NOT NULL CHECK (adjustment_type IN ('lost', 'damaged', 'found', 'correction')),
    quantity INTEGER NOT NULL,
    reason TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    requested_by UUID REFERENCES users(user_id),
    approved_by UUID REFERENCES users(user_id),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create inventory_flow_log table for tracking all changes
CREATE TABLE IF NOT EXISTS inventory_flow_log (
    log_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID REFERENCES inventory_daily_summary(id),
    cylinder_type_id UUID REFERENCES cylinder_types(cylinder_type_id),
    distributor_id VARCHAR(255) REFERENCES distributors(distributor_id),
    date DATE NOT NULL,
    flow_type VARCHAR(50) NOT NULL CHECK (flow_type IN ('order_placed', 'order_delivered', 'acfo_received', 'erv_sent', 'manual_adjustment', 'customer_return')),
    quantity INTEGER NOT NULL,
    source_id VARCHAR(255), -- order_id, invoice_id, adjustment_id, etc.
    source_type VARCHAR(50), -- 'order', 'invoice', 'adjustment', 'customer'
    previous_balance INTEGER,
    new_balance INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create audit log for inventory unaccounted details
CREATE TABLE IF NOT EXISTS inventory_unaccounted_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID NOT NULL REFERENCES inventory_daily_summary(id) ON DELETE CASCADE,
    distributor_id VARCHAR NOT NULL,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id),
    date DATE NOT NULL,
    count INT NOT NULL,
    reason TEXT NOT NULL,
    responsible_party UUID NOT NULL REFERENCES users(user_id),
    responsible_role VARCHAR(32), -- driver/inventory
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_date ON inventory_adjustments(date);
CREATE INDEX IF NOT EXISTS idx_inventory_adjustments_status ON inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_inventory_flow_log_date ON inventory_flow_log(date);
CREATE INDEX IF NOT EXISTS idx_inventory_flow_log_type ON inventory_flow_log(flow_type); 
CREATE INDEX IF NOT EXISTS idx_inv_unacc_summary_id ON inventory_unaccounted_audit_log(summary_id);
CREATE INDEX IF NOT EXISTS idx_inv_unacc_distributor_id ON inventory_unaccounted_audit_log(distributor_id);
CREATE INDEX IF NOT EXISTS idx_inv_unacc_cylinder_type_id ON inventory_unaccounted_audit_log(cylinder_type_id); 
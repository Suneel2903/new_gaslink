-- Settings Cylinder Thresholds Table
-- This table stores threshold quantities for each cylinder type per distributor
-- Used for low stock alerts and auto-replenishment triggers

CREATE TABLE IF NOT EXISTS settings_cylinder_thresholds (
    threshold_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    threshold_quantity INT NOT NULL DEFAULT 50,
    alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(distributor_id, cylinder_type_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_settings_cylinder_thresholds_distributor_id ON settings_cylinder_thresholds(distributor_id);
CREATE INDEX IF NOT EXISTS idx_settings_cylinder_thresholds_cylinder_type_id ON settings_cylinder_thresholds(cylinder_type_id);

-- Insert default thresholds for existing cylinder types (if any)
-- This will be run after the table is created to set up initial thresholds
INSERT INTO settings_cylinder_thresholds (distributor_id, cylinder_type_id, threshold_quantity)
SELECT 
    d.distributor_id,
    ct.cylinder_type_id,
    50 -- Default threshold of 50 units
FROM distributors d
CROSS JOIN cylinder_types ct
WHERE ct.is_active = TRUE AND ct.deleted_at IS NULL
ON CONFLICT (distributor_id, cylinder_type_id) DO NOTHING; 
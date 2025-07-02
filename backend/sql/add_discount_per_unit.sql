-- Add discount_per_unit column to order_items table
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS discount_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Add discount_per_unit column to invoice_items table if it doesn't exist
ALTER TABLE invoice_items ADD COLUMN IF NOT EXISTS discount_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0.00;

-- Update existing order_items to have proper discount_per_unit values
-- This will recalculate discounts based on customer discounts and cylinder prices
UPDATE order_items 
SET discount_per_unit = (
    SELECT COALESCE(c.discount, 0)
    FROM orders o
    JOIN customers c ON o.customer_id = c.customer_id
    WHERE o.order_id = order_items.order_id
)
WHERE discount_per_unit = 0 OR discount_per_unit IS NULL;

-- Update existing invoice_items to copy discount_per_unit from order_items
UPDATE invoice_items 
SET discount_per_unit = (
    SELECT oi.discount_per_unit
    FROM order_items oi
    JOIN invoices i ON oi.order_id = i.order_id
    WHERE i.invoice_id = invoice_items.invoice_id
    AND oi.cylinder_type_id = invoice_items.cylinder_type_id
)
WHERE discount_per_unit = 0 OR discount_per_unit IS NULL; 
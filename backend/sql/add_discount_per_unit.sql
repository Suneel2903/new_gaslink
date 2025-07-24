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

-- Rename per_kg_discount to per_cylinder_discount if it exists
ALTER TABLE customer_cylinder_discounts RENAME COLUMN per_kg_discount TO per_cylinder_discount;

-- One-time migration: Populate per-cylinder discount for all customers and cylinder types
INSERT INTO customer_cylinder_discounts (customer_id, cylinder_type_id, per_cylinder_discount, effective_from)
SELECT
  c.customer_id,
  ct.cylinder_type_id,
  COALESCE(c.discount, 0) AS per_cylinder_discount,
  CURRENT_DATE
FROM
  customers c
CROSS JOIN
  cylinder_types ct
WHERE NOT EXISTS (
  SELECT 1
  FROM customer_cylinder_discounts d
  WHERE d.customer_id = c.customer_id AND d.cylinder_type_id = ct.cylinder_type_id
);

-- (Optional) If you want to ensure the column is NOT NULL and has a default
ALTER TABLE customer_cylinder_discounts ALTER COLUMN per_cylinder_discount SET DEFAULT 0;
ALTER TABLE customer_cylinder_discounts ALTER COLUMN per_cylinder_discount SET NOT NULL; 
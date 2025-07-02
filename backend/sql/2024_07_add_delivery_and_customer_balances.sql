-- Create order_delivery_items table
CREATE TABLE IF NOT EXISTS order_delivery_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_item_id UUID NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    delivered_quantity INT NOT NULL DEFAULT 0,
    empties_collected INT NOT NULL DEFAULT 0,
    returned_quantity INT NOT NULL DEFAULT 0, -- confirmed returns after delivery
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_delivery_items_order_item_id ON order_delivery_items(order_item_id);

-- Create customer_inventory_balances table
CREATE TABLE IF NOT EXISTS customer_inventory_balances (
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    with_customer_qty INT NOT NULL DEFAULT 0,
    pending_returns INT NOT NULL DEFAULT 0,
    missing_qty INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT NOW(),
    PRIMARY KEY (customer_id, cylinder_type_id)
);
CREATE INDEX IF NOT EXISTS idx_cust_inv_bal_customer_id ON customer_inventory_balances(customer_id);
CREATE INDEX IF NOT EXISTS idx_cust_inv_bal_cylinder_type_id ON customer_inventory_balances(cylinder_type_id); 
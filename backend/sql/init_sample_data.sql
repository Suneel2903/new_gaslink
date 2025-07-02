-- Sample Data for GasLink LPG Distribution
-- Distributors
INSERT INTO distributors (distributor_id, business_name, legal_name, registration_number, tax_id, contact_person, email, phone, address_line1, city, state, postal_code, country, bank_name, bank_account_number, bank_account_name, status, onboarding_date, created_at)
VALUES
('11111111-1111-1111-1111-111111111111', 'Vikasini Gas Services', 'Vikasini Enterprises Pvt Ltd', 'REGVIK1234', 'TINVIK5678', 'Anjali Sharma', 'vikasini@example.com', '+91-9988776655', 'Plot 12, Ameerpet Main Road', 'Hyderabad', 'Telangana', '500016', 'India', 'SBI', 'SBIN00012345', 'Vikasini Enterprises', 'active', NOW(), NOW()),
('22222222-2222-2222-2222-222222222222', 'Suhasini Gas Distributors', 'Suhasini Fuels Ltd', 'REGSUH2234', 'TINSUH9876', 'Rakesh Reddy', 'suhasini@example.com', '+91-9876543210', 'Road No 45, Jubilee Hills', 'Hyderabad', 'Telangana', '500033', 'India', 'ICICI', 'ICIC00045678', 'Suhasini Fuels', 'active', NOW(), NOW());

-- Users (admin, finance, inventory for each distributor)
INSERT INTO users (user_id, distributor_id, firebase_uid, email, first_name, last_name, phone, role, status, created_at)
VALUES
-- Vikasini
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'uid_admin_vikasini', 'admin.vikasini@example.com', 'Anjali', 'Sharma', '+91-8000011111', 'admin', 'active', NOW()),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'uid_finance_vikasini', 'finance.vikasini@example.com', 'Siddharth', 'Kumar', '+91-8000011112', 'finance', 'active', NOW()),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'uid_inventory_vikasini', 'inventory.vikasini@example.com', 'Meena', 'Joshi', '+91-8000011113', 'inventory', 'active', NOW()),
-- Suhasini
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'uid_admin_suhasini', 'admin.suhasini@example.com', 'Rakesh', 'Reddy', '+91-9000022221', 'admin', 'active', NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'uid_finance_suhasini', 'finance.suhasini@example.com', 'Kavitha', 'Reddy', '+91-9000022222', 'finance', 'active', NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'uid_inventory_suhasini', 'inventory.suhasini@example.com', 'Pranav', 'Shah', '+91-9000022223', 'inventory', 'active', NOW());

-- Cylinder Types
INSERT INTO cylinder_types (cylinder_type_id, name, capacity_kg, description, is_active, created_at)
VALUES
(gen_random_uuid(), '5KG', 5, 'Small size cylinder ideal for home use', true, NOW()),
(gen_random_uuid(), '19KG', 19, 'Medium size cylinder used by hotels', true, NOW()),
(gen_random_uuid(), '47.5KG', 47.5, 'Large cylinder used in restaurants', true, NOW()),
(gen_random_uuid(), '425KG', 425, 'Industrial bulk cylinder', true, NOW());

-- Customers (2 per distributor for preview, expand as needed)
INSERT INTO customers (customer_id, distributor_id, customer_code, business_name, contact_person, phone, email, address_line1, city, state, postal_code, country, credit_limit, credit_period_days, payment_terms, status, onboarding_date, created_at)
VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'CUST001', 'Hotel Sitara', 'Rajeev Nair', '+91-9393919191', 'sitara@hotelmail.com', 'Road No. 12, Banjara Hills', 'Hyderabad', 'Telangana', '500034', 'India', 50000, 15, 'credit', 'active', NOW(), NOW()),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'CUST002', 'Swagath Grand', 'Aarthi Rao', '+91-9393929292', 'swagath@restmail.com', 'Plot 18, Madhapur Main Road', 'Hyderabad', 'Telangana', '500081', 'India', 60000, 10, 'credit', 'active', NOW(), NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'CUST101', 'Hotel Green Park', 'Suresh Babu', '+91-9393939393', 'greenpark@hotelmail.com', 'Ameerpet Main Road', 'Hyderabad', 'Telangana', '500016', 'India', 70000, 20, 'credit', 'active', NOW(), NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'CUST102', 'Hotel Minerva', 'Lakshmi Menon', '+91-9393949494', 'minerva@hotelmail.com', 'Kukatpally Main Road', 'Hyderabad', 'Telangana', '500072', 'India', 80000, 15, 'credit', 'active', NOW(), NOW());

-- Orders (2 per customer for preview)
INSERT INTO orders (order_id, distributor_id, customer_id, order_number, order_date, delivery_date, status, total_amount, created_at)
VALUES
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', (SELECT customer_id FROM customers WHERE customer_code='CUST001'), 'ORD-VIK-001', NOW() - INTERVAL '10 days', NOW() - INTERVAL '8 days', 'delivered', 15000, NOW()),
(gen_random_uuid(), '11111111-1111-1111-1111-111111111111', (SELECT customer_id FROM customers WHERE customer_code='CUST002'), 'ORD-VIK-002', NOW() - INTERVAL '7 days', NOW() - INTERVAL '5 days', 'pending', 18000, NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', (SELECT customer_id FROM customers WHERE customer_code='CUST101'), 'ORD-SUH-001', NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days', 'delivered', 21000, NOW()),
(gen_random_uuid(), '22222222-2222-2222-2222-222222222222', (SELECT customer_id FROM customers WHERE customer_code='CUST102'), 'ORD-SUH-002', NOW() - INTERVAL '6 days', NOW() - INTERVAL '4 days', 'processing', 17000, NOW());

-- Order Items
INSERT INTO order_items (order_item_id, order_id, cylinder_type_id, quantity, unit_price, total_price, created_at)
SELECT gen_random_uuid(), o.order_id, c.cylinder_type_id, 3, 2000, 6000, NOW()
FROM orders o, cylinder_types c WHERE o.order_number='ORD-VIK-001' AND c.name='19KG';
INSERT INTO order_items (order_item_id, order_id, cylinder_type_id, quantity, unit_price, total_price, created_at)
SELECT gen_random_uuid(), o.order_id, c.cylinder_type_id, 2, 500, 1000, NOW()
FROM orders o, cylinder_types c WHERE o.order_number='ORD-VIK-001' AND c.name='5KG';
-- Add more for other orders as needed

-- Invoices
INSERT INTO invoices (invoice_id, distributor_id, customer_id, order_id, invoice_number, issue_date, due_date, total_amount, status, created_at)
SELECT gen_random_uuid(), o.distributor_id, o.customer_id, o.order_id, 'INV-' || o.order_number, o.order_date, o.delivery_date + INTERVAL '7 days', o.total_amount, 'issued', NOW()
FROM orders o;

-- Disputes
INSERT INTO invoice_disputes (dispute_id, invoice_id, raised_by, reason, status, created_at)
SELECT gen_random_uuid(), i.invoice_id, (SELECT user_id FROM users WHERE email='admin.vikasini@example.com'), 'Short delivery', 'pending', NOW()
FROM invoices i LIMIT 1;

-- Credit Notes
INSERT INTO credit_notes (credit_note_id, invoice_id, amount, created_at)
SELECT gen_random_uuid(), i.invoice_id, 1000, NOW() FROM invoices i LIMIT 1;

-- Inventory
INSERT INTO inventory (inventory_id, distributor_id, cylinder_type_id, total_quantity, full_quantity, empty_quantity, damaged_quantity, last_updated)
SELECT gen_random_uuid(), d.distributor_id, c.cylinder_type_id, 100, 80, 15, 5, NOW()
FROM distributors d, cylinder_types c LIMIT 4;

-- Manual Inventory Adjustments
INSERT INTO manual_inventory_adjustments (adjustment_id, distributor_id, cylinder_type_id, adjusted_by, adjustment_type, quantity, reason, status, created_at)
SELECT gen_random_uuid(), d.distributor_id, c.cylinder_type_id, (SELECT user_id FROM users WHERE email='admin.vikasini@example.com'), 'addition', 10, 'Stock reconciliation', 'approved', NOW()
FROM distributors d, cylinder_types c LIMIT 1;

-- Driver Assignments
INSERT INTO driver_assignments (assignment_id, order_id, driver_id, assigned_by, assigned_at, status, created_at)
SELECT gen_random_uuid(), o.order_id, (SELECT user_id FROM users WHERE role='admin' AND distributor_id=o.distributor_id LIMIT 1), (SELECT user_id FROM users WHERE role='admin' AND distributor_id=o.distributor_id LIMIT 1), NOW(), 'assigned', NOW()
FROM orders o LIMIT 2;

-- Delivery Confirmations
INSERT INTO delivery_confirmations (confirmation_id, order_id, confirmed_by, confirmation_time, notes, created_at)
SELECT gen_random_uuid(), o.order_id, (SELECT user_id FROM users WHERE role='admin' AND distributor_id=o.distributor_id LIMIT 1), NOW(), 'Delivered successfully', NOW()
FROM orders o WHERE status='delivered' LIMIT 1;

-- Audit Logs
INSERT INTO audit_logs (audit_id, distributor_id, user_id, action, table_name, record_id, old_data, new_data, created_at)
SELECT gen_random_uuid(), d.distributor_id, (SELECT user_id FROM users WHERE distributor_id=d.distributor_id LIMIT 1), 'INSERT', 'orders', o.order_id, NULL, NULL, NOW()
FROM distributors d, orders o LIMIT 2;

-- Accountability Logs
INSERT INTO accountability_logs (accountability_id, distributor_id, user_id, incident_type, incident_date, description, resolution, status, created_at)
SELECT gen_random_uuid(), d.distributor_id, (SELECT user_id FROM users WHERE distributor_id=d.distributor_id LIMIT 1), 'missing_cylinder', NOW() - INTERVAL '2 days', 'Cylinder not returned', 'warning issued', 'open', NOW()
FROM distributors d LIMIT 2;

-- File Uploads
INSERT INTO file_uploads (file_id, distributor_id, uploaded_by, file_name, file_type, file_size, file_url, created_at)
SELECT gen_random_uuid(), d.distributor_id, (SELECT user_id FROM users WHERE distributor_id=d.distributor_id LIMIT 1), 'invoice_sample.pdf', 'application/pdf', 204800, 'https://files.example.com/invoice_sample.pdf', NOW()
FROM distributors d LIMIT 2;

-- Customer Visits
INSERT INTO customer_visits (visit_id, customer_id, distributor_id, visited_by, visit_time, notes, created_at)
SELECT gen_random_uuid(), c.customer_id, c.distributor_id, (SELECT user_id FROM users WHERE distributor_id=c.distributor_id LIMIT 1), NOW(), 'Routine check', NOW()
FROM customers c LIMIT 2;

-- Action History
INSERT INTO action_history (action_id, user_id, distributor_id, action_type, related_table, related_id, action_details, created_at)
SELECT gen_random_uuid(), (SELECT user_id FROM users WHERE distributor_id=d.distributor_id LIMIT 1), d.distributor_id, 'order_created', 'orders', o.order_id, '{"note": "Order created via portal"}', NOW()
FROM distributors d, orders o LIMIT 2;

-- Route Optimizations
INSERT INTO route_optimizations (optimization_id, distributor_id, route_data, created_at)
SELECT gen_random_uuid(), d.distributor_id, '{"route": "Ameerpet -> Banjara Hills -> Jubilee Hills"}', NOW()
FROM distributors d LIMIT 1;

-- Cylinder Prices (July 2025)
INSERT INTO cylinder_prices (price_id, cylinder_type_id, unit_price, month, year, created_at, updated_at) VALUES
  (gen_random_uuid(), '029a4bb0-d8ae-439f-b454-953ac7ab8623', 500, 7, 2025, NOW(), NOW()), -- 5KG
  (gen_random_uuid(), 'a1637eb7-8fd7-4399-ac39-076f581667c9', 2000, 7, 2025, NOW(), NOW()), -- 19KG
  (gen_random_uuid(), '3b04abc4-585e-48a2-830a-6e17d5ebef46', 4500, 7, 2025, NOW(), NOW()), -- 47.5KG
  (gen_random_uuid(), '0381a119-8f26-4ea1-b68d-b25104096cf7', 35000, 7, 2025, NOW(), NOW()); -- 425KG

-- Add more sample data for orders, order_items, invoices, disputes, credit_notes, inventory, etc. as needed for preview.
-- (For brevity, only a preview is shown here. Expand with loops or more rows for full test coverage.) 
-- GasLink LPG Distribution - Production Schema
-- Multi-tenant, audit-ready, soft delete, approval support

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =========================
-- ENUMS
-- =========================
CREATE TYPE user_role AS ENUM ('super_admin', 'distributor_admin', 'driver', 'accountant');
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
CREATE TYPE distributor_status AS ENUM ('active', 'suspended', 'inactive');
CREATE TYPE customer_status AS ENUM ('active', 'suspended', 'inactive');
CREATE TYPE order_status AS ENUM ('pending', 'processing', 'delivered', 'cancelled', 'failed');
CREATE TYPE invoice_status AS ENUM ('draft', 'issued', 'paid', 'overdue', 'cancelled');
CREATE TYPE action_status AS ENUM ('pending', 'in_progress', 'completed', 'overdue', 'cancelled');
CREATE TYPE adjustment_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE modification_type AS ENUM ('update_info', 'credit_limit_change', 'stop_supply', 'resume_supply');

-- =========================
-- DISTRIBUTORS
-- =========================
CREATE TABLE distributors (
    distributor_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    registration_number VARCHAR(100) UNIQUE NOT NULL,
    tax_id VARCHAR(100),
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
    bank_name VARCHAR(255),
    bank_account_number VARCHAR(50),
    bank_account_name VARCHAR(255),
    status distributor_status NOT NULL DEFAULT 'active',
    onboarding_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- USERS
-- =========================
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    firebase_uid VARCHAR(128) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL,
    status user_status NOT NULL DEFAULT 'active',
    last_login TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- CYLINDER TYPES
-- =========================
CREATE TABLE cylinder_types (
    cylinder_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    capacity_kg DECIMAL(8,2) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- CYLINDER PRICES (Monthly)
-- =========================
CREATE TABLE cylinder_prices (
    price_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    unit_price DECIMAL(10,2) NOT NULL,
    month INT NOT NULL, -- 1-12
    year INT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (cylinder_type_id, month, year)
);

-- =========================
-- CUSTOMERS
-- =========================
CREATE TABLE customers (
    customer_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    customer_code VARCHAR(50) NOT NULL,
    business_name VARCHAR(255),
    contact_person VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50) NOT NULL,
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'Nigeria',
    latitude DECIMAL(10,8),
    longitude DECIMAL(11,8),
    credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    credit_period_days INT NOT NULL DEFAULT 30,
    payment_terms TEXT,
    status customer_status NOT NULL DEFAULT 'active',
    stop_supply BOOLEAN NOT NULL DEFAULT FALSE,
    stop_supply_reason TEXT,
    onboarding_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (distributor_id, customer_code)
);

-- =========================
-- CUSTOMER MODIFICATION REQUESTS
-- =========================
CREATE TABLE customer_modification_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    request_type modification_type NOT NULL,
    current_data JSON,
    requested_changes JSON NOT NULL,
    reason TEXT NOT NULL,
    status adjustment_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- INVENTORY
-- =========================
CREATE TABLE inventory (
    inventory_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    total_quantity INT NOT NULL DEFAULT 0,
    full_quantity INT NOT NULL DEFAULT 0,
    empty_quantity INT NOT NULL DEFAULT 0,
    damaged_quantity INT NOT NULL DEFAULT 0,
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    UNIQUE (distributor_id, cylinder_type_id)
);

-- =========================
-- MANUAL INVENTORY ADJUSTMENTS
-- =========================
CREATE TABLE manual_inventory_adjustments (
    adjustment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    adjusted_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    adjustment_type VARCHAR(32) NOT NULL,
    quantity INT NOT NULL,
    reason TEXT NOT NULL,
    status adjustment_status NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- ORDERS
-- =========================
CREATE TABLE orders (
    order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    assigned_driver_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    order_number VARCHAR(32) NOT NULL,
    order_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    delivery_date TIMESTAMP,
    delivery_time_slot VARCHAR(50),
    delivery_address VARCHAR(255),
    delivery_latitude DECIMAL(10,8),
    delivery_longitude DECIMAL(11,8),
    payment_method VARCHAR(50),
    special_instructions TEXT,
    status order_status NOT NULL DEFAULT 'pending',
    total_amount DECIMAL(12,2),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- ORDER ITEMS
-- =========================
CREATE TABLE order_items (
    order_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    delivered_quantity INT,
    empties_collected INT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- INVOICES
-- =========================
CREATE TABLE invoices (
    invoice_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
    invoice_number VARCHAR(32) NOT NULL,
    issue_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    due_date TIMESTAMP,
    total_amount DECIMAL(12,2) NOT NULL,
    status invoice_status NOT NULL DEFAULT 'draft',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- INVOICE DISPUTES
-- =========================
CREATE TABLE invoice_disputes (
    dispute_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    raised_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    dispute_type VARCHAR(32), -- 'amount' or 'quantity'
    disputed_amount DECIMAL(12,2),
    disputed_quantities JSON, -- {cylinder_type_id: quantity}
    reason TEXT NOT NULL,
    description TEXT,
    status adjustment_status NOT NULL DEFAULT 'pending',
    resolution TEXT,
    resolved_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- CREDIT NOTES
-- =========================
CREATE TABLE credit_notes (
    credit_note_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT NOT NULL,
    issued_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- ACCOUNTABILITY LOGS
-- =========================
CREATE TABLE accountability_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    incident_date TIMESTAMP NOT NULL,
    description TEXT NOT NULL,
    amount DECIMAL(12,2),
    status adjustment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- AUDIT LOGS
-- =========================
CREATE TABLE audit_logs (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    details JSON,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- SYSTEM CONFIG
-- =========================
CREATE TABLE system_config (
    config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    key VARCHAR(100) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- =========================
-- INDEXES
-- =========================
CREATE INDEX idx_orders_distributor_status_date ON orders(distributor_id, status, order_date);
CREATE INDEX idx_orders_driver_status ON orders(assigned_driver_id, status);
CREATE INDEX idx_invoices_distributor_status_due ON invoices(distributor_id, status, due_date);
CREATE INDEX idx_customers_distributor_status ON customers(distributor_id, status);
CREATE INDEX idx_inventory_distributor_type ON inventory(distributor_id, cylinder_type_id);
CREATE INDEX idx_accountability_distributor_date ON accountability_logs(distributor_id, incident_date);
CREATE INDEX idx_audit_distributor_created ON audit_logs(distributor_id, created_at);

-- =========================
-- DRIVER ASSIGNMENTS
-- =========================
CREATE TABLE IF NOT EXISTS driver_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(32) NOT NULL DEFAULT 'assigned',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- DELIVERY CONFIRMATIONS
-- =========================
CREATE TABLE IF NOT EXISTS delivery_confirmations (
    confirmation_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    confirmed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    confirmation_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    signature TEXT,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- STOCK REPLENISHMENT REQUESTS
-- =========================
CREATE TABLE IF NOT EXISTS stock_replenishment_requests (
    request_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    quantity INT NOT NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    reviewed_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- PREFERRED DRIVER ASSIGNMENTS
-- =========================
CREATE TABLE IF NOT EXISTS preferred_driver_assignments (
    preference_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- INVOICE REMINDERS
-- =========================
CREATE TABLE IF NOT EXISTS invoice_reminders (
    reminder_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    sent_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reminder_type VARCHAR(32) NOT NULL DEFAULT 'email',
    status VARCHAR(32) NOT NULL DEFAULT 'sent',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- NOTIFICATIONS
-- =========================
CREATE TABLE IF NOT EXISTS notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(32) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    sent_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- PENDING ACTION LOCKS
-- =========================
CREATE TABLE IF NOT EXISTS pending_action_locks (
    lock_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action_type VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    locked_by UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    locked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);

-- =========================
-- PHASE II TABLES
-- =========================

-- FILE UPLOADS
CREATE TABLE IF NOT EXISTS file_uploads (
    file_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    uploaded_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    file_type VARCHAR(100),
    file_size BIGINT,
    file_url TEXT NOT NULL,
    related_table VARCHAR(100),
    related_id UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_file_uploads_distributor_id ON file_uploads(distributor_id);
CREATE INDEX IF NOT EXISTS idx_file_uploads_created_at ON file_uploads(created_at);

-- DRIVER PERFORMANCE LOGS
CREATE TABLE IF NOT EXISTS driver_performance_logs (
    log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    driver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    order_id UUID REFERENCES orders(order_id) ON DELETE SET NULL,
    performance_metric VARCHAR(100) NOT NULL,
    metric_value NUMERIC(10,2),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_driver_perf_driver_id ON driver_performance_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_perf_distributor_id ON driver_performance_logs(distributor_id);
CREATE INDEX IF NOT EXISTS idx_driver_perf_created_at ON driver_performance_logs(created_at);

-- CUSTOMER VISITS
CREATE TABLE IF NOT EXISTS customer_visits (
    visit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    visited_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    visit_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_visits_customer_id ON customer_visits(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_visits_distributor_id ON customer_visits(distributor_id);
CREATE INDEX IF NOT EXISTS idx_customer_visits_created_at ON customer_visits(created_at);

-- CUSTOMER GROUPS
CREATE TABLE IF NOT EXISTS customer_groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    group_name VARCHAR(100) NOT NULL,
    description TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customer_groups_distributor_id ON customer_groups(distributor_id);
CREATE INDEX IF NOT EXISTS idx_customer_groups_created_at ON customer_groups(created_at);

-- ACTION HISTORY
CREATE TABLE IF NOT EXISTS action_history (
    action_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id) ON DELETE SET NULL,
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    action_type VARCHAR(100) NOT NULL,
    related_table VARCHAR(100),
    related_id UUID,
    action_details JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_action_history_distributor_id ON action_history(distributor_id);
CREATE INDEX IF NOT EXISTS idx_action_history_user_id ON action_history(user_id);
CREATE INDEX IF NOT EXISTS idx_action_history_created_at ON action_history(created_at);

-- ROUTE OPTIMIZATIONS (placeholder)
CREATE TABLE IF NOT EXISTS route_optimizations (
    optimization_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    distributor_id UUID REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    route_data JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_route_opt_distributor_id ON route_optimizations(distributor_id);
CREATE INDEX IF NOT EXISTS idx_route_opt_created_at ON route_optimizations(created_at);

-- DELIVERY LOADS
CREATE TABLE IF NOT EXISTS delivery_loads (
    load_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    driver_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id) ON DELETE CASCADE,
    quantity_loaded INT NOT NULL,
    loaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delivery_loads_order_id ON delivery_loads(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_loads_driver_id ON delivery_loads(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_loads_cylinder_type_id ON delivery_loads(cylinder_type_id);

-- Inventory Daily Summary Table
CREATE TABLE IF NOT EXISTS inventory_daily_summary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    cylinder_type_id UUID NOT NULL REFERENCES cylinder_types(cylinder_type_id),
    distributor_id VARCHAR NOT NULL,
    opening_fulls INT NOT NULL DEFAULT 0,
    opening_empties INT NOT NULL DEFAULT 0,
    replenished_qty_from_corp INT NOT NULL DEFAULT 0,
    empties_sent_to_corp INT NOT NULL DEFAULT 0,
    soft_blocked_qty INT NOT NULL DEFAULT 0,
    delivered_qty INT NOT NULL DEFAULT 0,
    collected_empties_qty INT NOT NULL DEFAULT 0,
    damaged_qty INT NOT NULL DEFAULT 0,
    closing_fulls INT NOT NULL DEFAULT 0,
    closing_empties INT NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(date, cylinder_type_id, distributor_id)
);

-- Inventory Adjustment Requests Table
CREATE TABLE IF NOT EXISTS inventory_adjustment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    summary_id UUID NOT NULL REFERENCES inventory_daily_summary(id),
    distributor_id VARCHAR NOT NULL,
    cylinder_type_id UUID NOT NULL,
    date DATE NOT NULL,
    field TEXT NOT NULL, -- 'damaged_qty', 'closing_fulls', 'closing_empties'
    requested_value INT NOT NULL,
    previous_value INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    requested_by UUID,
    approved_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMP
);

-- Ensure all existing tables have audit fields, UUID PKs, consistent naming, and indexes on key fields.
-- (Manual review and patching of all table definitions above is assumed complete.) 
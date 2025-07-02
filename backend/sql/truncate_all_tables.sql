-- Disable triggers to avoid FK errors
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' DISABLE TRIGGER ALL;';
    END LOOP;
END $$;

-- Truncate all tables (order: child to parent)
TRUNCATE TABLE 
    order_items, orders, invoices, invoice_disputes, credit_notes, 
    manual_inventory_adjustments, inventory, customers, users, distributors, 
    cylinder_types, driver_assignments, delivery_confirmations, 
    file_uploads, customer_visits, customer_groups, action_history, 
    route_optimizations, audit_logs, accountability_logs, 
    stock_replenishment_requests, preferred_driver_assignments, 
    invoice_reminders, notifications, pending_action_locks
RESTART IDENTITY CASCADE;

-- Re-enable triggers
DO $$ DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'ALTER TABLE public.' || quote_ident(r.tablename) || ' ENABLE TRIGGER ALL;';
    END LOOP;
END $$; 
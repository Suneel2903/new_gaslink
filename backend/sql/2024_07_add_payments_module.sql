-- Payment Transactions Table
CREATE TABLE IF NOT EXISTS payment_transactions (
    payment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES customers(customer_id) ON DELETE CASCADE,
    distributor_id UUID NOT NULL REFERENCES distributors(distributor_id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    payment_method VARCHAR(32) NOT NULL,
    payment_reference VARCHAR(128),
    allocation_mode VARCHAR(16) NOT NULL CHECK (allocation_mode IN ('auto', 'manual')),
    received_by UUID REFERENCES users(user_id) ON DELETE SET NULL,
    received_at TIMESTAMP NOT NULL DEFAULT NOW(),
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_id ON payment_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_distributor_id ON payment_transactions(distributor_id);

-- Payment Allocations Table
CREATE TABLE IF NOT EXISTS payment_allocations (
    allocation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payment_transactions(payment_id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoices(invoice_id) ON DELETE CASCADE,
    allocated_amount DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id); 
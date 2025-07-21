-- ===============================
-- Invoice-Payment Reconciliation Enhancements
-- ===============================

-- 1. Update invoice_status enum (Postgres requires drop/create for enums)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status') THEN
    ALTER TYPE invoice_status RENAME TO invoice_status_old;
    CREATE TYPE invoice_status AS ENUM ('PENDING_APPROVAL', 'ISSUED/UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');
    ALTER TABLE invoices ALTER COLUMN status TYPE invoice_status USING status::text::invoice_status;
    DROP TYPE invoice_status_old;
  END IF;
END$$;

-- 2. Add amount_paid and outstanding_amount to invoices
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outstanding_amount DECIMAL(12,2) NOT NULL DEFAULT 0;

-- 3. Add allocation_status and unallocated_amount to payment_transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='allocation_status'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN allocation_status VARCHAR(32) DEFAULT 'UNALLOCATED';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='payment_transactions' AND column_name='unallocated_amount'
  ) THEN
    ALTER TABLE payment_transactions ADD COLUMN unallocated_amount DECIMAL(12,2) NOT NULL DEFAULT 0;
  END IF;
END$$;

-- 4. Add check constraint for allocation_status
ALTER TABLE payment_transactions
  DROP CONSTRAINT IF EXISTS payment_transactions_allocation_status_check;
ALTER TABLE payment_transactions
  ADD CONSTRAINT payment_transactions_allocation_status_check
  CHECK (allocation_status IN ('ALLOCATED', 'PARTIALLY_ALLOCATED', 'UNALLOCATED'));

-- 5. (Payment allocations table already exists and is correct)
-- No action needed. 
const db = require('../db.js');
const { getEffectiveUserId } = require('../utils/authUtils');

// Get all payments with customer and distributor details
const getAllPayments = async (req, res) => {
    try {
        const { role } = req.user;
        let { distributor_id } = req.user;
        if (role === 'super_admin') {
            distributor_id = req.query.distributor_id;
            if (!distributor_id) {
                return res.status(400).json({ error: 'Super admin must select a distributor first.' });
            }
        }
        if (!distributor_id) {
            return res.status(400).json({ error: 'Missing distributor_id in request.' });
        }
        const query = `
            SELECT 
                pt.*,
                c.business_name AS customer_name,
                c.phone,
                COALESCE(u.first_name || ' ' || u.last_name, 'Admin') as received_by_name
            FROM payment_transactions pt
            LEFT JOIN customers c ON pt.customer_id = c.customer_id
            LEFT JOIN users u ON pt.received_by = u.user_id
            WHERE pt.distributor_id = $1
            ORDER BY pt.created_at DESC
        `;
        
        const result = await db.query(query, [distributor_id]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
};

// Get payment by ID with allocations
const getPaymentById = async (req, res) => {
    try {
        const { paymentId } = req.params;
        
        // Get payment details
        const paymentQuery = `
            SELECT 
                pt.*,
                c.business_name AS customer_name,
                c.phone,
                COALESCE(u.first_name || ' ' || u.last_name, 'Admin') as received_by_name
            FROM payment_transactions pt
            LEFT JOIN customers c ON pt.customer_id = c.customer_id
            LEFT JOIN users u ON pt.received_by = u.user_id
            WHERE pt.payment_id = $1
        `;
        
        const paymentResult = await db.query(paymentQuery, [paymentId]);
        
        if (paymentResult.rows.length === 0) {
            return res.status(404).json({ error: 'Payment not found' });
        }
        
        // Get payment allocations
        const allocationsQuery = `
            SELECT 
                pa.*,
                i.invoice_number,
                i.total_amount,
                i.status as invoice_status
            FROM payment_allocations pa
            LEFT JOIN invoices i ON pa.invoice_id = i.invoice_id
            WHERE pa.payment_id = $1
        `;
        
        const allocationsResult = await db.query(allocationsQuery, [paymentId]);
        
        const payment = paymentResult.rows[0];
        payment.allocations = allocationsResult.rows;
        
        res.json(payment);
    } catch (error) {
        console.error('Error fetching payment:', error);
        res.status(500).json({ error: 'Failed to fetch payment' });
    }
};

// Create new payment
const createPayment = async (req, res) => {
    const client = await db.connect();
    
    try {
        await client.query('BEGIN');
        
        const {
            customer_id,
            distributor_id,
            amount,
            payment_method,
            payment_reference,
            allocation_mode,
            notes,
            allocations = [] // For manual allocation
        } = req.body;
        
        // Validate required fields
        if (!customer_id || !distributor_id || !amount || !payment_method || !allocation_mode) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // Create payment transaction
        const paymentQuery = `
            INSERT INTO payment_transactions (
                customer_id, distributor_id, amount, payment_method, 
                payment_reference, allocation_mode, received_by, notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        
        const paymentResult = await client.query(paymentQuery, [
            customer_id,
            distributor_id,
            amount,
            payment_method,
            payment_reference,
            allocation_mode,
            null, // Set to null for admin-only testing
            notes
        ]);
        
        const payment = paymentResult.rows[0];
        
        // Handle allocations based on mode
        if (allocation_mode === 'auto') {
            await performAutoAllocation(client, payment.payment_id, customer_id, amount);
        } else if (allocation_mode === 'manual' && allocations.length > 0) {
            await performManualAllocation(client, payment.payment_id, allocations);
        }
        
        await client.query('COMMIT');
        
        // Return the created payment with allocations
        const fullPayment = await getPaymentWithAllocations(client, payment.payment_id);
        res.status(201).json(fullPayment);
        
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error creating payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    } finally {
        client.release();
    }
};

// Enhanced auto allocation logic
const performAutoAllocation = async (client, paymentId, customerId, totalAmount) => {
    // Get outstanding invoices for customer (oldest first, only ISSUED/UNPAID or PARTIALLY_PAID)
    const invoicesQuery = `
        SELECT 
            invoice_id,
            total_amount,
            COALESCE(amount_paid, 0) as amount_paid,
            COALESCE(outstanding_amount, total_amount) as outstanding_amount
        FROM invoices
        WHERE customer_id = $1
        AND status IN ('ISSUED/UNPAID', 'PARTIALLY_PAID')
        ORDER BY issue_date ASC, created_at ASC
    `;
    const invoicesResult = await client.query(invoicesQuery, [customerId]);
    const invoices = invoicesResult.rows;
    let remainingAmount = totalAmount;
    let totalAllocated = 0;
    for (const invoice of invoices) {
        if (remainingAmount <= 0) break;
        const outstanding = Number(invoice.outstanding_amount);
        if (outstanding <= 0) continue;
        const allocationAmount = Math.min(remainingAmount, outstanding);
        // Insert allocation
        await client.query(
            'INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
            [paymentId, invoice.invoice_id, allocationAmount]
        );
        // Update invoice amount_paid and outstanding_amount
        await client.query(
            `UPDATE invoices
             SET amount_paid = COALESCE(amount_paid, 0) + $1,
                 outstanding_amount = GREATEST(total_amount - (COALESCE(amount_paid, 0) + $1), 0)
             WHERE invoice_id = $2`,
            [allocationAmount, invoice.invoice_id]
        );
        // Update invoice status
        const invoiceStatusRes = await client.query('SELECT total_amount, amount_paid, outstanding_amount FROM invoices WHERE invoice_id = $1', [invoice.invoice_id]);
        const { total_amount, amount_paid, outstanding_amount } = invoiceStatusRes.rows[0];
        let newStatus = 'ISSUED/UNPAID';
        if (Number(amount_paid) >= Number(total_amount)) {
            newStatus = 'PAID';
        } else if (Number(amount_paid) > 0 && Number(outstanding_amount) > 0) {
            newStatus = 'PARTIALLY_PAID';
        }
        await client.query('UPDATE invoices SET status = $1 WHERE invoice_id = $2', [newStatus, invoice.invoice_id]);
        remainingAmount -= allocationAmount;
        totalAllocated += allocationAmount;
    }
    // Update payment allocation_status and unallocated_amount
    let allocationStatus = 'ALLOCATED';
    let unallocatedAmount = totalAmount - totalAllocated;
    if (unallocatedAmount > 0 && totalAllocated > 0) allocationStatus = 'PARTIALLY_ALLOCATED';
    if (totalAllocated === 0) allocationStatus = 'UNALLOCATED';
    await client.query(
        'UPDATE payment_transactions SET allocation_status = $1, unallocated_amount = $2 WHERE payment_id = $3',
        [allocationStatus, unallocatedAmount, paymentId]
    );
};

// Enhanced manual allocation logic
const performManualAllocation = async (client, paymentId, allocations) => {
    // 1. Validate all invoices belong to the same customer
    let customerId = null;
    for (const allocation of allocations) {
        const { invoice_id } = allocation;
        const invoiceRes = await client.query('SELECT customer_id FROM invoices WHERE invoice_id = $1', [invoice_id]);
        if (invoiceRes.rows.length === 0) throw new Error(`Invoice ${invoice_id} not found`);
        if (!customerId) customerId = invoiceRes.rows[0].customer_id;
        if (invoiceRes.rows[0].customer_id !== customerId) throw new Error('All invoices must belong to the same customer');
    }
    // 2. Calculate total allocated
    const totalAllocated = allocations.reduce((sum, a) => sum + Number(a.allocated_amount), 0);
    // 3. Get payment amount
    const paymentRes = await client.query('SELECT amount FROM payment_transactions WHERE payment_id = $1', [paymentId]);
    if (paymentRes.rows.length === 0) throw new Error('Payment not found');
    const paymentAmount = Number(paymentRes.rows[0].amount);
    if (totalAllocated > paymentAmount) throw new Error('Total allocated exceeds payment amount');
    // 4. Insert allocations and update invoices
    for (const allocation of allocations) {
        const { invoice_id, allocated_amount } = allocation;
        // Insert allocation
        await client.query(
            'INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
            [paymentId, invoice_id, allocated_amount]
        );
        // Update invoice amount_paid and outstanding_amount
        await client.query(
            `UPDATE invoices
             SET amount_paid = COALESCE(amount_paid, 0) + $1,
                 outstanding_amount = GREATEST(total_amount - (COALESCE(amount_paid, 0) + $1), 0)
             WHERE invoice_id = $2`,
            [allocated_amount, invoice_id]
        );
        // Update invoice status
        const invoiceStatusRes = await client.query('SELECT total_amount, amount_paid, outstanding_amount FROM invoices WHERE invoice_id = $1', [invoice_id]);
        const { total_amount, amount_paid, outstanding_amount } = invoiceStatusRes.rows[0];
        let newStatus = 'ISSUED/UNPAID';
        if (Number(amount_paid) >= Number(total_amount)) {
            newStatus = 'PAID';
        } else if (Number(amount_paid) > 0 && Number(outstanding_amount) > 0) {
            newStatus = 'PARTIALLY_PAID';
        }
        await client.query('UPDATE invoices SET status = $1 WHERE invoice_id = $2', [newStatus, invoice_id]);
    }
    // 5. Update payment allocation_status and unallocated_amount
    let allocationStatus = 'ALLOCATED';
    let unallocatedAmount = paymentAmount - totalAllocated;
    if (unallocatedAmount > 0 && totalAllocated > 0) allocationStatus = 'PARTIALLY_ALLOCATED';
    if (totalAllocated === 0) allocationStatus = 'UNALLOCATED';
    await client.query(
        'UPDATE payment_transactions SET allocation_status = $1, unallocated_amount = $2 WHERE payment_id = $3',
        [allocationStatus, unallocatedAmount, paymentId]
    );
};

// Update invoice statuses based on allocations
const updateInvoiceStatuses = async (client, customerId) => {
    const updateQuery = `
        UPDATE invoices 
        SET status = CASE 
            WHEN total_amount <= COALESCE(
                (SELECT SUM(allocated_amount) 
                 FROM payment_allocations 
                 WHERE invoice_id = invoices.invoice_id), 0
            ) THEN 'paid'::invoice_status
            WHEN COALESCE(
                (SELECT SUM(allocated_amount) 
                 FROM payment_allocations 
                 WHERE invoice_id = invoices.invoice_id), 0
            ) > 0 THEN 'issued'::invoice_status
            ELSE 'issued'::invoice_status
        END
        WHERE customer_id = $1
    `;
    
    await client.query(updateQuery, [customerId]);
};

// Get payment with allocations helper
const getPaymentWithAllocations = async (client, paymentId) => {
    const paymentQuery = `
        SELECT 
            pt.*,
            c.business_name AS customer_name,
            c.phone,
            COALESCE(u.first_name || ' ' || u.last_name, 'Admin') as received_by_name
        FROM payment_transactions pt
        LEFT JOIN customers c ON pt.customer_id = c.customer_id
        LEFT JOIN users u ON pt.received_by = u.user_id
        WHERE pt.payment_id = $1
    `;
    
    const paymentResult = await client.query(paymentQuery, [paymentId]);
    const payment = paymentResult.rows[0];
    
    const allocationsQuery = `
        SELECT 
            pa.*,
            i.invoice_number,
            i.total_amount,
            i.status as invoice_status
        FROM payment_allocations pa
        LEFT JOIN invoices i ON pa.invoice_id = i.invoice_id
        WHERE pa.payment_id = $1
    `;
    
    const allocationsResult = await client.query(allocationsQuery, [paymentId]);
    payment.allocations = allocationsResult.rows;
    
    return payment;
};

// Get outstanding invoices for customer
const getOutstandingInvoices = async (req, res) => {
    try {
        const { customerId } = req.params;
        
        const query = `
            SELECT 
                i.*,
                COALESCE(
                    (SELECT SUM(allocated_amount) 
                     FROM payment_allocations 
                     WHERE invoice_id = i.invoice_id), 0
                ) as allocated_amount,
                (i.total_amount - COALESCE(
                    (SELECT SUM(allocated_amount) 
                     FROM payment_allocations 
                     WHERE invoice_id = i.invoice_id), 0
                )) as outstanding_amount
            FROM invoices i
            WHERE i.customer_id = $1 
            AND i.status IN ('issued', 'paid')
            ORDER BY i.created_at ASC
        `;
        
        const result = await db.query(query, [customerId]);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching outstanding invoices:', error);
        res.status(500).json({ error: 'Failed to fetch outstanding invoices' });
    }
};

// Get payment summary/reports
const getPaymentSummary = async (req, res) => {
    try {
        const { startDate, endDate, customerId, distributorId } = req.query;
        
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;
        
        if (startDate) {
            whereClause += ` AND pt.created_at >= $${paramIndex}`;
            params.push(startDate);
            paramIndex++;
        }
        
        if (endDate) {
            whereClause += ` AND pt.created_at <= $${paramIndex}`;
            params.push(endDate);
            paramIndex++;
        }
        
        if (customerId) {
            whereClause += ` AND pt.customer_id = $${paramIndex}`;
            params.push(customerId);
            paramIndex++;
        }
        
        if (distributorId) {
            whereClause += ` AND pt.distributor_id = $${paramIndex}`;
            params.push(distributorId);
            paramIndex++;
        }
        
        const query = `
            SELECT 
                pt.payment_id,
                pt.customer_id,
                pt.distributor_id,
                pt.amount,
                pt.payment_method,
                pt.payment_reference,
                pt.allocation_mode,
                pt.allocation_status,
                pt.unallocated_amount,
                pt.notes,
                pt.created_at,
                COALESCE(c.business_name, 'N/A') as customer_name,
                COALESCE(u.first_name || ' ' || u.last_name, 'Admin') as received_by_name
            FROM payment_transactions pt
            LEFT JOIN customers c ON pt.customer_id = c.customer_id
            LEFT JOIN users u ON pt.received_by = u.user_id
            ${whereClause}
            ORDER BY pt.created_at DESC
        `;
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payment summary:', error);
        res.status(500).json({ error: 'Failed to fetch payment summary' });
    }
};

// Dummy implementations for missing functions
const updatePayment = (req, res) => res.status(501).json({ error: 'Not implemented' });
const deletePayment = (req, res) => res.status(501).json({ error: 'Not implemented' });
const getCustomerPayments = (req, res) => res.status(501).json({ error: 'Not implemented' });

module.exports = {
  createPayment,
  getPayment: getPaymentById,
  getAllPayments,
  updatePayment,
  deletePayment,
  getCustomerPayments,
  getOutstandingInvoices,
  getPaymentSummary
};
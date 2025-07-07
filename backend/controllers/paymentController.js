const db = require('../db.js');
const { getEffectiveUserId } = require('../utils/authUtils');

// Get all payments with customer and distributor details
const getAllPayments = async (req, res) => {
    try {
        const query = `
            SELECT 
                pt.*,
                c.business_name AS customer_name,
                c.phone,
                COALESCE(u.first_name || ' ' || u.last_name, 'Admin') as received_by_name
            FROM payment_transactions pt
            LEFT JOIN customers c ON pt.customer_id = c.customer_id
            LEFT JOIN users u ON pt.received_by = u.user_id
            ORDER BY pt.created_at DESC
        `;
        
        const result = await db.query(query);
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

// Auto allocation logic
const performAutoAllocation = async (client, paymentId, customerId, totalAmount) => {
    // Get outstanding invoices for customer (oldest first)
    const invoicesQuery = `
        SELECT 
            invoice_id,
            total_amount,
            COALESCE(
                (SELECT SUM(allocated_amount) 
                 FROM payment_allocations 
                 WHERE invoice_id = i.invoice_id), 0
            ) as allocated_amount
        FROM invoices i
        WHERE i.customer_id = $1 
        AND i.status IN ('issued', 'paid')
        ORDER BY i.created_at ASC
    `;
    
    const invoicesResult = await client.query(invoicesQuery, [customerId]);
    const invoices = invoicesResult.rows;
    
    let remainingAmount = totalAmount;
    
    for (const invoice of invoices) {
        if (remainingAmount <= 0) break;
        
        const outstandingAmount = invoice.total_amount - invoice.allocated_amount;
        if (outstandingAmount <= 0) continue;
        
        const allocationAmount = Math.min(remainingAmount, outstandingAmount);
        
        // Create allocation
        await client.query(
            'INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
            [paymentId, invoice.invoice_id, allocationAmount]
        );
        
        remainingAmount -= allocationAmount;
    }
    
    // Update invoice statuses
    await updateInvoiceStatuses(client, customerId);
};

// Manual allocation logic
const performManualAllocation = async (client, paymentId, allocations) => {
    for (const allocation of allocations) {
        const { invoice_id, allocated_amount } = allocation;
        
        if (!invoice_id || !allocated_amount) {
            throw new Error('Invalid allocation data');
        }
        
        // Validate allocation amount doesn't exceed invoice outstanding
        const invoiceQuery = `
            SELECT 
                total_amount,
                COALESCE(
                    (SELECT SUM(allocated_amount) 
                     FROM payment_allocations 
                     WHERE invoice_id = $1), 0
                ) as allocated_amount
            FROM invoices 
            WHERE invoice_id = $1
        `;
        
        const invoiceResult = await client.query(invoiceQuery, [invoice_id]);
        const invoice = invoiceResult.rows[0];
        
        if (!invoice) {
            throw new Error(`Invoice ${invoice_id} not found`);
        }
        
        const outstandingAmount = invoice.total_amount - invoice.allocated_amount;
        if (allocated_amount > outstandingAmount) {
            throw new Error(`Allocation amount exceeds outstanding amount for invoice ${invoice_id}`);
        }
        
        // Create allocation
        await client.query(
            'INSERT INTO payment_allocations (payment_id, invoice_id, allocated_amount) VALUES ($1, $2, $3)',
            [paymentId, invoice_id, allocated_amount]
        );
    }
    
    // Update invoice statuses
    const customerQuery = 'SELECT customer_id FROM invoices WHERE invoice_id = $1';
    const customerResult = await client.query(customerQuery, [allocations[0].invoice_id]);
    await updateInvoiceStatuses(client, customerResult.rows[0].customer_id);
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
                COUNT(*) as total_payments,
                SUM(amount) as total_amount,
                payment_method,
                allocation_mode
            FROM payment_transactions pt
            ${whereClause}
            GROUP BY payment_method, allocation_mode
            ORDER BY total_amount DESC
        `;
        
        const result = await db.query(query, params);
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching payment summary:', error);
        res.status(500).json({ error: 'Failed to fetch payment summary' });
    }
};

// Update a payment (basic implementation)
const updatePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, payment_method, payment_reference, notes } = req.body;
    const fields = [];
    const values = [];
    let idx = 1;
    if (amount !== undefined) { fields.push(`amount = $${idx++}`); values.push(amount); }
    if (payment_method !== undefined) { fields.push(`payment_method = $${idx++}`); values.push(payment_method); }
    if (payment_reference !== undefined) { fields.push(`payment_reference = $${idx++}`); values.push(payment_reference); }
    if (notes !== undefined) { fields.push(`notes = $${idx++}`); values.push(notes); }
    if (fields.length === 0) return res.status(400).json({ error: 'No fields to update' });
    values.push(id);
    const query = `UPDATE payment_transactions SET ${fields.join(', ')}, updated_at = NOW() WHERE payment_id = $${idx} RETURNING *`;
    const { rows } = await db.query(query, values);
    if (rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update payment', details: err.message });
  }
};

// Delete a payment (hard delete)
const deletePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await db.query(
      'DELETE FROM payment_transactions WHERE payment_id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Payment not found' });
    res.json({ message: 'Payment deleted', payment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete payment', details: err.message });
  }
};

// Get all payments for a customer
const getCustomerPayments = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const result = await db.query(
      `SELECT * FROM payment_transactions WHERE customer_id = $1 ORDER BY created_at DESC`,
      [customer_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer payments', details: err.message });
  }
};

const getPayment = getPaymentById;

module.exports = {
    getAllPayments,
    getPayment,
    createPayment,
    updatePayment,
    deletePayment,
    getCustomerPayments,
    getOutstandingInvoices,
    getPaymentSummary
}; 
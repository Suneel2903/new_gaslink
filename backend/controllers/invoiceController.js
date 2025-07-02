import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// Create invoice from delivered order
export const createInvoiceFromOrder = async (req, res) => {
    const { order_id } = req.params;
    const { distributor_id } = req.user; // From auth middleware
    const { issued_by } = req.user; // User creating the invoice

    try {
        // Check if order exists and is delivered
        const orderQuery = `
            SELECT o.*, c.credit_period_days, c.grace_period_days
            FROM orders o
            JOIN customers c ON o.customer_id = c.customer_id
            WHERE o.order_id = $1 AND o.distributor_id = $2 AND o.status = 'delivered'
        `;
        const orderResult = await db.query(orderQuery, [order_id, distributor_id]);
        
        if (orderResult.rows.length === 0) {
            return res.status(404).json({ 
                error: 'Order not found or not delivered' 
            });
        }

        const order = orderResult.rows[0];

        // Check if invoice already exists for this order
        const existingInvoiceQuery = `
            SELECT invoice_id FROM invoices 
            WHERE order_id = $1 AND distributor_id = $2
        `;
        const existingInvoiceResult = await db.query(existingInvoiceQuery, [order_id, distributor_id]);
        
        if (existingInvoiceResult.rows.length > 0) {
            return res.status(400).json({ 
                error: 'Invoice already exists for this order' 
            });
        }

        // Calculate due date based on credit period
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + order.credit_period_days);

        // Get order items and calculate total_amount
        const orderItemsQuery = `
            SELECT oi.*, ct.name as cylinder_type_name
            FROM order_items oi
            JOIN cylinder_types ct ON oi.cylinder_type_id = ct.cylinder_type_id
            WHERE oi.order_id = $1
        `;
        const orderItemsResult = await db.query(orderItemsQuery, [order_id]);

        if (!orderItemsResult.rows.length) {
            console.error('No order items found for order', order_id);
            return res.status(400).json({ error: 'Cannot create invoice: no order items found for this order.' });
        }

        // Fetch customer discount for accurate calculation
        const customerDiscountQuery = `
            SELECT discount FROM customers WHERE customer_id = $1
        `;
        const customerDiscountResult = await db.query(customerDiscountQuery, [order.customer_id]);
        const customerDiscount = customerDiscountResult.rows[0]?.discount || 0;

        // Fetch current prices for the delivery month/year
        const deliveryDate = new Date(order.delivery_date);
        const month = deliveryDate.getMonth() + 1;
        const year = deliveryDate.getFullYear();
        
        const priceQuery = `
            SELECT cylinder_type_id, unit_price 
            FROM cylinder_prices 
            WHERE month = $1 AND year = $2
        `;
        const priceResult = await db.query(priceQuery, [month, year]);
        const priceMap = {};
        priceResult.rows.forEach(row => {
            priceMap[row.cylinder_type_id] = parseFloat(row.unit_price);
        });

        // Calculate total_amount using delivered quantities and current prices/discounts
        let totalAmount = 0;
        for (const item of orderItemsResult.rows) {
            // Use delivered_quantity if available, otherwise use original quantity
            const quantity = item.delivered_quantity !== null && item.delivered_quantity !== undefined 
                ? Number(item.delivered_quantity) 
                : Number(item.quantity);
            
            // Get current unit price for this cylinder type
            const currentUnitPrice = priceMap[item.cylinder_type_id] || 0;
            
            // Calculate effective price (same logic as order creation)
            const effectiveUnitPrice = Math.max(currentUnitPrice - customerDiscount, 0);
            
            // Calculate total for this item
            const itemTotal = quantity * effectiveUnitPrice;
            totalAmount += itemTotal;
            
            console.log(`Invoice item calculation: cylinder_type_id=${item.cylinder_type_id}, quantity=${quantity}, currentUnitPrice=${currentUnitPrice}, customerDiscount=${customerDiscount}, effectiveUnitPrice=${effectiveUnitPrice}, itemTotal=${itemTotal}`);
        }

        // Generate invoice number
        const invoiceNumber = `INV-${order.order_number}-${Date.now()}`;

        // Start transaction
        await db.query('BEGIN');

        // Create invoice
        const invoiceQuery = `
            INSERT INTO invoices (
                distributor_id, customer_id, order_id, invoice_number,
                issue_date, due_date, total_amount, status, issued_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
        `;
        const invoiceResult = await db.query(invoiceQuery, [
            distributor_id, order.customer_id, order_id, invoiceNumber,
            new Date(), dueDate, totalAmount, 'issued', issued_by
        ]);

        const invoice = invoiceResult.rows[0];

        // Create invoice items with current prices and discounts
        for (const item of orderItemsResult.rows) {
            // Use delivered_quantity if available, otherwise use original quantity
            const quantity = item.delivered_quantity !== null && item.delivered_quantity !== undefined 
                ? Number(item.delivered_quantity) 
                : Number(item.quantity);
            
            // Get current unit price for this cylinder type
            const currentUnitPrice = priceMap[item.cylinder_type_id] || 0;
            
            // Calculate effective price (same logic as order creation)
            const effectiveUnitPrice = Math.max(currentUnitPrice - customerDiscount, 0);
            
            // Calculate total for this item
            const itemTotal = quantity * effectiveUnitPrice;
            
            const invoiceItemQuery = `
                INSERT INTO invoice_items (
                    invoice_id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await db.query(invoiceItemQuery, [
                invoice.invoice_id, item.cylinder_type_id, 
                Math.round(quantity), currentUnitPrice, customerDiscount, itemTotal
            ]);
        }

        await db.query('COMMIT');

        // Return created invoice with items
        const invoiceWithItemsQuery = `
            SELECT i.*, 
                   json_agg(
                       json_build_object(
                           'invoice_item_id', ii.invoice_item_id,
                           'cylinder_type_id', ii.cylinder_type_id,
                           'quantity', ii.quantity,
                           'unit_price', ii.unit_price,
                           'discount_per_unit', ii.discount_per_unit,
                           'total_price', ii.total_price,
                           'cylinder_type_name', ct.name
                       )
                   ) as items
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
            LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.cylinder_type_id
            WHERE i.invoice_id = $1
            GROUP BY i.invoice_id
        `;
        const finalResult = await db.query(invoiceWithItemsQuery, [invoice.invoice_id]);

        if (!finalResult.rows[0].items || !Array.isArray(finalResult.rows[0].items) || (finalResult.rows[0].items.length === 1 && finalResult.rows[0].items[0] === null)) {
            finalResult.rows[0].items = [];
        }

        res.status(201).json({
            message: 'Invoice created successfully',
            invoice: finalResult.rows[0]
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice', details: error.message });
    }
};

// Get invoice by ID
export const getInvoice = async (req, res) => {
    const { id } = req.params;
    const { distributor_id } = req.user;

    try {
        const query = `
            SELECT i.*, 
                   c.business_name, c.contact_person, c.phone, c.email,
                   c.address_line1, c.city, c.state, c.postal_code,
                   json_agg(
                       json_build_object(
                           'invoice_item_id', ii.invoice_item_id,
                           'cylinder_type_id', ii.cylinder_type_id,
                           'quantity', ii.quantity,
                           'unit_price', ii.unit_price,
                           'discount_per_unit', ii.discount_per_unit,
                           'total_price', ii.total_price,
                           'cylinder_type_name', ct.name
                       )
                   ) as items
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.customer_id
            LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
            LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.cylinder_type_id
            WHERE i.invoice_id = $1 AND i.distributor_id = $2
            GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email,
                     c.address_line1, c.city, c.state, c.postal_code
        `;
        
        const result = await db.query(query, [id, distributor_id]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = result.rows[0];

        if (!invoice.items || !Array.isArray(invoice.items) || (invoice.items.length === 1 && invoice.items[0] === null)) {
            invoice.items = [];
        }

        res.json({ invoice: invoice });

    } catch (error) {
        console.error('Error fetching invoice:', error);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
};

// Utility to parse disputed_quantities
function parseDisputeRow(row) {
  if (row && row.disputed_quantities && typeof row.disputed_quantities === 'string') {
    try {
      row.disputed_quantities = JSON.parse(row.disputed_quantities);
    } catch (e) {
      row.disputed_quantities = {};
    }
  }
  return row;
}

// Raise dispute on invoice
export const raiseDispute = async (req, res) => {
    const { id } = req.params;
    if (!req.user || !req.user.user_id) {
        return res.status(401).json({ error: 'User authentication required to raise dispute' });
    }
    const { distributor_id, user_id } = req.user;
    const { reason, dispute_type, disputed_amount, disputed_quantities, description } = req.body;

    if (!reason || !dispute_type) {
        return res.status(400).json({ error: 'Reason and dispute type are required' });
    }

    try {
        // Check if invoice exists and belongs to distributor
        const invoiceQuery = `
            SELECT invoice_id FROM invoices 
            WHERE invoice_id = $1 AND distributor_id = $2
        `;
        const invoiceResult = await db.query(invoiceQuery, [id, distributor_id]);
        
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        // Check if dispute already exists
        const existingDisputeQuery = `
            SELECT dispute_id FROM invoice_disputes 
            WHERE invoice_id = $1 AND status = 'pending'
        `;
        const existingDisputeResult = await db.query(existingDisputeQuery, [id]);
        
        if (existingDisputeResult.rows.length > 0) {
            return res.status(400).json({ error: 'Dispute already exists for this invoice' });
        }

        // Create dispute
        const disputeQuery = `
            INSERT INTO invoice_disputes (
                invoice_id, raised_by, reason, status, dispute_type, disputed_amount, disputed_quantities, description
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;
        const disputeResult = await db.query(disputeQuery, [
            id, user_id, reason, 'pending', dispute_type, disputed_amount || null, disputed_quantities ? JSON.stringify(disputed_quantities) : null, description || null
        ]);

        // If quantity dispute, create pending manual inventory adjustments
        if (dispute_type === 'quantity' && disputed_quantities) {
            for (const [cylinder_type_id, qty] of Object.entries(disputed_quantities)) {
                const adjustmentQuery = `
                    INSERT INTO manual_inventory_adjustments (
                        distributor_id, cylinder_type_id, adjusted_by,
                        adjustment_type, quantity, reason, status,
                        reference_type, reference_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `;
                await db.query(adjustmentQuery, [
                    distributor_id, cylinder_type_id, user_id,
                    'add', qty, 'Dispute raised – quantity adjustment',
                    'pending', 'invoice_dispute', disputeResult.rows[0].dispute_id
                ]);
            }
        }

        // Update invoice status to pending_approval
        const updateInvoiceStatusQuery = `
            UPDATE invoices SET status = 'pending_approval' WHERE invoice_id = $1
        `;
        await db.query(updateInvoiceStatusQuery, [id]);

        console.log(`Invoice ${id} status updated to pending_approval`);

        res.status(201).json({
            message: 'Dispute raised successfully',
            dispute: parseDisputeRow(disputeResult.rows[0])
        });

    } catch (error) {
        console.error('Error raising dispute:', error);
        res.status(500).json({ error: 'Failed to raise dispute' });
    }
};

// Issue credit note
export const issueCreditNote = async (req, res) => {
    const { id } = req.params;
    const { distributor_id, user_id } = req.user;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
        return res.status(400).json({ error: 'Amount and reason are required' });
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }

    try {
        // Check if invoice exists and belongs to distributor
        const invoiceQuery = `
            SELECT invoice_id, total_amount FROM invoices 
            WHERE invoice_id = $1 AND distributor_id = $2
        `;
        const invoiceResult = await db.query(invoiceQuery, [id, distributor_id]);
        
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];

        // Validate amount
        if (amount > invoice.total_amount) {
            return res.status(400).json({ error: 'Credit amount cannot exceed invoice total' });
        }

        // Create credit note
        const creditNoteQuery = `
            INSERT INTO credit_notes (
                invoice_id, amount, reason, issued_by
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
        `;
        const creditNoteResult = await db.query(creditNoteQuery, [id, amount, reason, user_id]);

        // Update invoice status to pending_approval
        const updateInvoiceStatusQuery2 = `
            UPDATE invoices SET status = 'pending_approval' WHERE invoice_id = $1
        `;
        await db.query(updateInvoiceStatusQuery2, [id]);

        console.log(`Invoice ${id} status updated to pending_approval`);

        res.status(201).json({
            message: 'Credit note issued successfully',
            credit_note: creditNoteResult.rows[0]
        });

    } catch (error) {
        console.error('Error issuing credit note:', error);
        res.status(500).json({ error: 'Failed to issue credit note' });
    }
};

// Cancel invoice
export const cancelInvoice = async (req, res) => {
    const { id } = req.params;
    if (!req.user || !req.user.user_id) {
        return res.status(401).json({ error: 'User authentication required to cancel invoice' });
    }
    const { distributor_id, user_id } = req.user;

    try {
        // Check if invoice exists and can be cancelled
        const invoiceQuery = `
            SELECT i.*, 
                   json_agg(
                       json_build_object(
                           'cylinder_type_id', ii.cylinder_type_id,
                           'quantity', ii.quantity
                       )
                   ) as items
            FROM invoices i
            LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
            WHERE i.invoice_id = $1 AND i.distributor_id = $2
            GROUP BY i.invoice_id
        `;
        const invoiceResult = await db.query(invoiceQuery, [id, distributor_id]);
        
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];

        // Check if invoice can be cancelled (not already cancelled or paid)
        if (invoice.status === 'cancelled') {
            return res.status(400).json({ error: 'Invoice is already cancelled' });
        }

        if (invoice.status === 'paid') {
            return res.status(400).json({ error: 'Cannot cancel paid invoice' });
        }

        // Start transaction
        await db.query('BEGIN');

        // Update invoice status to pending_approval
        const updateInvoiceStatusQuery3 = `
            UPDATE invoices SET status = 'pending_approval' WHERE invoice_id = $1
        `;
        await db.query(updateInvoiceStatusQuery3, [id]);

        // Create manual inventory adjustment requests for each item
        for (const item of invoice.items) {
            const adjustmentQuery = `
                INSERT INTO manual_inventory_adjustments (
                    distributor_id, cylinder_type_id, adjusted_by,
                    adjustment_type, quantity, reason, status,
                    reference_type, reference_id
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `;
            await db.query(adjustmentQuery, [
                distributor_id, item.cylinder_type_id, user_id,
                'add', item.quantity, 'Invoice cancelled – stock adjustment',
                'pending', 'invoice', id
            ]);
        }

        await db.query('COMMIT');

        console.log(`Invoice ${id} status updated to pending_approval`);

        res.json({
            message: 'Invoice cancelled successfully',
            inventory_adjustments_created: invoice.items.length
        });

    } catch (error) {
        await db.query('ROLLBACK');
        console.error('Error cancelling invoice:', error);
        res.status(500).json({ error: 'Failed to cancel invoice' });
    }
};

// Update invoice statuses (cron job endpoint)
export const updateInvoiceStatuses = async (req, res) => {
    const { distributor_id } = req.user;

    try {
        // Update overdue invoices
        const overdueQuery = `
            UPDATE invoices 
            SET status = 'overdue'
            WHERE distributor_id = $1 
              AND status IN ('issued', 'partially_paid')
              AND due_date < CURRENT_DATE
        `;
        const overdueResult = await db.query(overdueQuery, [distributor_id]);

        // Get overdue count for response
        const overdueCountQuery = `
            SELECT COUNT(*) as count
            FROM invoices 
            WHERE distributor_id = $1 AND status = 'overdue'
        `;
        const overdueCountResult = await db.query(overdueCountQuery, [distributor_id]);

        res.json({
            message: 'Invoice statuses updated successfully',
            overdue_invoices_updated: overdueResult.rowCount,
            total_overdue_invoices: overdueCountResult.rows[0].count
        });

    } catch (error) {
        console.error('Error updating invoice statuses:', error);
        res.status(500).json({ error: 'Failed to update invoice statuses' });
    }
};

// Get all invoices for distributor
export const getAllInvoices = async (req, res) => {
    const { distributor_id } = req.user;
    const { status, customer_id, page = 1, limit = 10 } = req.query;

    try {
        let whereClause = 'WHERE i.distributor_id = $1';
        let params = [distributor_id];
        let paramCount = 1;

        if (status) {
            paramCount++;
            whereClause += ` AND i.status = $${paramCount}`;
            params.push(status);
        }

        if (customer_id) {
            paramCount++;
            whereClause += ` AND i.customer_id = $${paramCount}`;
            params.push(customer_id);
        }

        // Get total count
        const countQuery = `
            SELECT COUNT(*) as total
            FROM invoices i
            ${whereClause}
        `;
        const countResult = await db.query(countQuery, params);
        const total = parseInt(countResult.rows[0].total);

        // Get invoices with pagination
        const offset = (page - 1) * limit;
        paramCount++;
        const query = `
            SELECT i.*, 
                   c.business_name, c.contact_person,
                   COALESCE(
                       (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                       0
                   ) as total_credits,
                   (i.total_amount - COALESCE(
                       (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                       0
                   )) as outstanding_amount
            FROM invoices i
            LEFT JOIN customers c ON i.customer_id = c.customer_id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT $${paramCount} OFFSET $${paramCount + 1}
        `;
        params.push(limit, offset);

        const result = await db.query(query, params);

        res.json({
            invoices: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('Error fetching invoices:', error);
        res.status(500).json({ error: 'Failed to fetch invoices' });
    }
};

export const downloadInvoicePdf = async (req, res) => {
  const { id } = req.params;
  const { distributor_id } = req.user;
  try {
    // Fetch invoice details
    const query = `
      SELECT i.*, c.business_name, c.contact_person, c.phone, c.email, c.gstin,
             c.address_line1, c.address_line2, c.city, c.state, c.postal_code,
             json_agg(
               json_build_object(
                 'invoice_item_id', ii.invoice_item_id,
                 'cylinder_type_id', ii.cylinder_type_id,
                 'quantity', ii.quantity,
                 'unit_price', ii.unit_price,
                 'discount_per_unit', ii.discount_per_unit,
                 'total_price', ii.total_price,
                 'cylinder_type_name', ct.name
               )
             ) as items
      FROM invoices i
      LEFT JOIN customers c ON i.customer_id = c.customer_id
      LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
      LEFT JOIN cylinder_types ct ON ii.cylinder_type_id = ct.cylinder_type_id
      WHERE i.invoice_id = $1 AND i.distributor_id = $2
      GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email, c.gstin,
               c.address_line1, c.address_line2, c.city, c.state, c.postal_code
    `;
    const result = await db.query(query, [id, distributor_id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = result.rows[0];
    if (!invoice.items || !Array.isArray(invoice.items) || (invoice.items.length === 1 && invoice.items[0] === null)) {
      invoice.items = [];
    }
    // Company info (placeholder)
    const company = {
      name: 'GasLink',
      address: '123, Main Road, Industrial Area, Bengaluru, Karnataka, 560001',
      phone: '+91-9876543210',
      email: 'support@gaslink.com',
      gstin: '29ABCDE1234F2Z5',
    };
    // Customer info
    const customer = {
      name: invoice.business_name || 'Customer Name',
      contact: invoice.contact_person || 'Contact Person',
      phone: invoice.phone || 'N/A',
      email: invoice.email || 'N/A',
      gstin: invoice.gstin || 'N/A',
      address: `${invoice.address_line1 || ''} ${invoice.address_line2 || ''}, ${invoice.city || ''}, ${invoice.state || ''} - ${invoice.postal_code || ''}`.replace(/\s+/g, ' ').trim(),
    };
    // Invoice meta
    const meta = {
      number: invoice.invoice_number,
      date: new Date(invoice.issue_date).toLocaleDateString('en-IN'),
      due: new Date(invoice.due_date).toLocaleDateString('en-IN'),
      order: invoice.order_id,
      status: (invoice.status || '').toUpperCase(),
    };
    // Calculate totals
    let subtotal = 0, totalDiscount = 0;
    invoice.items.forEach(item => {
      subtotal += Number(item.unit_price) * Number(item.quantity);
      totalDiscount += Number(item.discount_per_unit) * Number(item.quantity);
    });
    const taxRate = 0.18;
    const tax = (subtotal - totalDiscount) * taxRate;
    const grandTotal = subtotal - totalDiscount + tax;
    // Generate PDF
    const doc = new PDFDocument({ margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${meta.number}.pdf`);
    doc.pipe(res);
    // --- Header: Logo + Company/Meta Grid ---
    const logoPath = path.resolve('backend/gaslink_logo.png');
    let headerY = 40;
    // Draw logo (60x60)
    try {
      doc.image(logoPath, 40, headerY, { width: 60, height: 60 });
    } catch (e) {
      doc.rect(40, headerY, 60, 60).stroke();
      doc.fontSize(10).text('GasLink', 45, headerY + 25);
    }
    // Company info next to logo
    doc.fontSize(18).fillColor('#0a3d62').font('Helvetica-Bold').text(company.name, 110, headerY, { align: 'left' });
    doc.fontSize(10).fillColor('black').font('Helvetica').text(company.address, 110, headerY + 20, { align: 'left' });
    doc.text(`Phone: ${company.phone} | Email: ${company.email}`, 110, headerY + 35, { align: 'left' });
    doc.text(`GSTIN: ${company.gstin}`, 110, headerY + 50, { align: 'left' });
    // Invoice meta (right column)
    let metaY = headerY;
    doc.fontSize(16).fillColor('#222f3e').font('Helvetica-Bold').text('TAX INVOICE', 350, metaY, { align: 'right' });
    metaY += 20;
    doc.fontSize(9).fillColor('black').font('Helvetica').text(`Invoice No: ${meta.number}`, 350, metaY, { align: 'right', width: 200 });
    metaY += 12;
    doc.text(`Invoice Date: ${meta.date}`, 350, metaY, { align: 'right', width: 200 });
    metaY += 12;
    doc.text(`Due Date: ${meta.due}`, 350, metaY, { align: 'right', width: 200 });
    metaY += 12;
    doc.fontSize(8).text(`Order ID: ${meta.order}`, 350, metaY, { align: 'right', width: 200 });
    metaY += 12;
    doc.fontSize(9).text(`Status: ${meta.status}`, 350, metaY, { align: 'right', width: 200 });
    // Horizontal line below header
    let sectionStartY = Math.max(headerY + 65, metaY + 10) + 10;
    doc.moveTo(40, sectionStartY).lineTo(550, sectionStartY).strokeColor('#0a3d62').lineWidth(1).stroke();
    // --- Customer Info ---
    let custY = sectionStartY + 10;
    doc.fontSize(12).fillColor('#0a3d62').font('Helvetica-Bold').text('Bill To:', 40, custY);
    doc.fontSize(10).fillColor('black').font('Helvetica').text(customer.name, 40, custY + 15);
    doc.text(customer.address, 40, custY + 30);
    doc.text(`GSTIN: ${customer.gstin}`, 40, custY + 45);
    doc.text(`Contact: ${customer.contact}`, 40, custY + 60);
    doc.text(`Phone: ${customer.phone}`, 40, custY + 75);
    doc.text(`Email: ${customer.email}`, 40, custY + 90);
    // --- Table Header ---
    let tableTop = custY + 115;
    doc.rect(40, tableTop - 5, 510, 25).fillAndStroke('#f1f2f6', '#aaa');
    doc.fontSize(11).fillColor('#222f3e').font('Helvetica-Bold');
    const colX = [45, 155, 240, 340, 440];
    doc.text('Cylinder Type', colX[0], tableTop, { width: colX[1] - colX[0] });
    doc.text('Qty', colX[1], tableTop, { width: colX[2] - colX[1], align: 'right' });
    doc.text('Unit Price', colX[2], tableTop, { width: colX[3] - colX[2], align: 'right' });
    doc.text('Discount', colX[3], tableTop, { width: colX[4] - colX[3], align: 'right' });
    doc.text('Total', colX[4], tableTop, { width: 70, align: 'right' });
    // --- Table Rows ---
    doc.fontSize(10).fillColor('black').font('Helvetica');
    let y = tableTop + 20;
    invoice.items.forEach((item, idx) => {
      if (idx % 2 === 1) {
        doc.rect(40, y - 2, 510, 18).fill('#f8f9fa');
        doc.fillColor('black');
      }
      doc.text(item.cylinder_type_name, colX[0], y, { width: colX[1] - colX[0] });
      doc.text(item.quantity, colX[1], y, { width: colX[2] - colX[1], align: 'right' });
      doc.text(`₹${Number(item.unit_price).toFixed(2)}`, colX[2], y, { width: colX[3] - colX[2], align: 'right' });
      doc.text(`₹${Number(item.discount_per_unit).toFixed(2)}`, colX[3], y, { width: colX[4] - colX[3], align: 'right' });
      doc.text(`₹${Number(item.total_price).toFixed(2)}`, colX[4], y, { width: 70, align: 'right' });
      y += 18;
    });
    // Table border
    doc.rect(40, tableTop - 5, 510, y - tableTop + 5).stroke('#aaa');
    // --- Totals Box ---
    let totalsY = y + 10;
    doc.rect(320, totalsY, 230, 70).fillAndStroke('#f1f2f6', '#aaa');
    let tY = totalsY + 8;
    doc.fontSize(11).fillColor('#222f3e').font('Helvetica-Bold').text('Subtotal:', 330, tY, { width: 100, align: 'right' });
    doc.font('Helvetica').fillColor('black').fontSize(10).text(`₹${subtotal.toFixed(2)}`, 440, tY, { width: 100, align: 'right' });
    tY += 15;
    doc.font('Helvetica-Bold').fillColor('#222f3e').fontSize(11).text('Total Discount:', 330, tY, { width: 100, align: 'right' });
    doc.font('Helvetica').fillColor('black').fontSize(10).text(`₹${totalDiscount.toFixed(2)}`, 440, tY, { width: 100, align: 'right' });
    tY += 15;
    doc.font('Helvetica-Bold').fillColor('#222f3e').fontSize(11).text('GST (18%):', 330, tY, { width: 100, align: 'right' });
    doc.font('Helvetica').fillColor('black').fontSize(10).text(`₹${tax.toFixed(2)}`, 440, tY, { width: 100, align: 'right' });
    tY += 15;
    doc.font('Helvetica-Bold').fillColor('#0a3d62').fontSize(12).text('Grand Total:', 330, tY, { width: 100, align: 'right' });
    doc.font('Helvetica-Bold').fillColor('#0a3d62').fontSize(12).text(`₹${grandTotal.toFixed(2)}`, 440, tY, { width: 100, align: 'right' });
    // --- Footer ---
    doc.moveTo(40, tY + 30).lineTo(550, tY + 30).strokeColor('#aaa').stroke();
    doc.fontSize(10).fillColor('gray').font('Helvetica').text('Thank you for your business!', 40, tY + 40, { align: 'center', width: 510 });
    doc.text('Please make payment within the due date. For queries, contact support@gaslink.com', 40, tY + 55, { align: 'center', width: 510 });
    doc.text('This is a system-generated invoice and does not require a signature.', 40, tY + 70, { align: 'center', width: 510 });
    doc.end();
    doc.on('end', () => {
      console.log(`PDF for invoice ${meta.number} fully written.`);
    });
    res.on('close', () => {
      console.log(`Response closed for invoice PDF ${meta.number}`);
    });
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate invoice PDF' });
    }
  }
}; 
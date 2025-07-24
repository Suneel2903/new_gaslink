const db = require('../db.js');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { getEffectiveUserId } = require('../utils/authUtils');
const { getAuthToken, generateIRN, generateCreditNoteIRN, cancelIRN } = require('../services/gstService');
const tokenService = require('../services/tokenService');
const axios = require('axios');

// Create invoice from delivered order
const createInvoiceFromOrder = async (req, res) => {
    const { order_id } = req.params;
    const { role, distributor_id } = req.user; // From auth middleware
    const { issued_by } = req.user; // User creating the invoice

    console.log('[createInvoiceFromOrder] Called for order_id:', order_id);

    try {
        // Check if order exists and is delivered
        let orderQuery, orderParams;
        if (role === 'super_admin') {
            // Super_admin can create invoices for any order
            orderQuery = `
                SELECT o.*, c.credit_period_days, c.grace_period_days
                FROM orders o
                JOIN customers c ON o.customer_id = c.customer_id
                WHERE o.order_id = $1 AND o.status = 'delivered'
            `;
            orderParams = [order_id];
        } else {
            // Regular users can only create invoices for their distributor's orders
            orderQuery = `
                SELECT o.*, c.credit_period_days, c.grace_period_days
                FROM orders o
                JOIN customers c ON o.customer_id = c.customer_id
                WHERE o.order_id = $1 AND o.distributor_id = $2 AND o.status = 'delivered'
            `;
            orderParams = [order_id, distributor_id];
        }
        
        const orderResult = await db.query(orderQuery, orderParams);
        
        if (orderResult.rows.length === 0) {
            console.error('[createInvoiceFromOrder] Order not found or not delivered:', order_id);
            return res.status(404).json({ 
                error: 'Order not found or not delivered' 
            });
        }

        const order = orderResult.rows[0];
        const orderDistributorId = order.distributor_id;

        // Check if invoice already exists for this order
        const existingInvoiceQuery = `
            SELECT invoice_id FROM invoices 
            WHERE order_id = $1 AND distributor_id = $2
        `;
        const existingInvoiceResult = await db.query(existingInvoiceQuery, [order_id, orderDistributorId]);
        
        if (existingInvoiceResult.rows.length > 0) {
            console.warn('[createInvoiceFromOrder] Invoice already exists for order:', order_id);
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
            console.error('[createInvoiceFromOrder] No order items found for order', order_id);
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
            
            // For each order item, fetch per-cylinder discount for this customer and cylinder type
            const discountResult = await db.query(
              'SELECT per_cylinder_discount FROM customer_cylinder_discounts WHERE customer_id = $1 AND cylinder_type_id = $2',
              [order.customer_id, item.cylinder_type_id]
            );
            let discount_per_unit = discountResult.rows[0]?.per_cylinder_discount;
            if (discount_per_unit === undefined) {
              // Fallback to flat customer discount if per-cylinder not found
              const flatDiscountResult = await db.query(
                'SELECT discount FROM customers WHERE customer_id = $1',
                [order.customer_id]
              );
              discount_per_unit = flatDiscountResult.rows[0]?.discount || 0;
              console.warn(`[InvoiceController] No per-cylinder discount found for customer ${order.customer_id}, cylinder ${item.cylinder_type_id}. Falling back to flat discount.`);
            }
            // Calculate effective price (same logic as order creation)
            const effectiveUnitPrice = Math.max(currentUnitPrice - discount_per_unit, 0);
            
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
                issue_date, due_date, total_amount, status, einvoice_status, issued_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING *
        `;
        const invoiceResult = await db.query(invoiceQuery, [
            orderDistributorId, order.customer_id, order_id, invoiceNumber,
            new Date(), dueDate, totalAmount, 'draft', 'PENDING', issued_by
        ]);

        const invoice = invoiceResult.rows[0];

        // GST API sync intentionally removed from this step.
        // Use /api/gst/generate/:invoice_id endpoint to trigger GST IRN generation.
        // const gstResult = await syncWithGSTSite('invoice', invoice);
        // if (!gstResult.success) {
        //     await db.query('ROLLBACK');
        //     return res.status(500).json({ error: 'Failed to sync invoice with GST site', details: gstResult.error });
        // }
        // await db.query('UPDATE invoices SET gst_document_url = $1 WHERE invoice_id = $2', [gstResult.gst_url, invoice.invoice_id]);

        // Create invoice items with current prices and discounts
        for (const item of orderItemsResult.rows) {
            // Use delivered_quantity if available, otherwise use original quantity
            const quantity = item.delivered_quantity !== null && item.delivered_quantity !== undefined 
                ? Number(item.delivered_quantity) 
                : Number(item.quantity);
            
            // Get current unit price for this cylinder type
            const currentUnitPrice = priceMap[item.cylinder_type_id] || 0;
            
            // For each order item, fetch per-cylinder discount for this customer and cylinder type
            const discountResult = await db.query(
              'SELECT per_cylinder_discount FROM customer_cylinder_discounts WHERE customer_id = $1 AND cylinder_type_id = $2',
              [order.customer_id, item.cylinder_type_id]
            );
            let discount_per_unit = discountResult.rows[0]?.per_cylinder_discount;
            if (discount_per_unit === undefined) {
              // Fallback to flat customer discount if per-cylinder not found
              const flatDiscountResult = await db.query(
                'SELECT discount FROM customers WHERE customer_id = $1',
                [order.customer_id]
              );
              discount_per_unit = flatDiscountResult.rows[0]?.discount || 0;
              console.warn(`[InvoiceController] No per-cylinder discount found for customer ${order.customer_id}, cylinder ${item.cylinder_type_id}. Falling back to flat discount.`);
            }
            // Calculate effective price (same logic as order creation)
            const effectiveUnitPrice = Math.max(currentUnitPrice - discount_per_unit, 0);
            
            // Calculate total for this item
            const itemTotal = quantity * effectiveUnitPrice;
            
            const invoiceItemQuery = `
                INSERT INTO invoice_items (
                    invoice_id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price
                ) VALUES ($1, $2, $3, $4, $5, $6)
            `;
            await db.query(invoiceItemQuery, [
                invoice.invoice_id, item.cylinder_type_id, 
                Math.round(quantity), currentUnitPrice, discount_per_unit, itemTotal
            ]);
        }

        await db.query('COMMIT');
        console.log('[createInvoiceFromOrder] Invoice created successfully for order_id:', order_id);

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
        console.error('[createInvoiceFromOrder] Error creating invoice:', error);
        res.status(500).json({ error: 'Failed to create invoice', details: error.message });
    }
};

// Get invoice by ID
const getInvoice = async (req, res) => {
    const { id } = req.params;
    const { role, distributor_id } = req.user;

    // Debug context logging
    console.log('[getInvoice] Called with:', { id, role, distributor_id });

    try {
        let query, params;
        if (role === 'super_admin') {
            query = `
                SELECT i.invoice_id, i.invoice_number, i.issue_date, i.total_amount, i.cgst_value, i.sgst_value, i.igst_value, i.einvoice_status, i.irn, i.ack_no, i.ack_date, i.gst_invoice_json, i.signed_qr_code,
                       c.business_name, c.contact_person, c.phone, c.email,
                       c.address_line1, c.city, c.state, c.postal_code,
                       o.order_id, o.order_number, o.delivery_date, o.status as order_status,
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
                LEFT JOIN orders o ON i.order_id = o.order_id
                WHERE i.invoice_id = $1 AND i.deleted_at IS NULL
                GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email,
                         c.address_line1, c.city, c.state, c.postal_code,
                         o.order_id, o.order_number, o.delivery_date, o.status
            `;
            params = [id];
        } else {
            query = `
                SELECT i.invoice_id, i.invoice_number, i.issue_date, i.total_amount, i.cgst_value, i.sgst_value, i.igst_value, i.einvoice_status, i.irn, i.ack_no, i.ack_date, i.gst_invoice_json, i.signed_qr_code,
                       c.business_name, c.contact_person, c.phone, c.email,
                       c.address_line1, c.city, c.state, c.postal_code,
                       o.order_id, o.order_number, o.delivery_date, o.status as order_status,
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
                LEFT JOIN orders o ON i.order_id = o.order_id
                WHERE i.invoice_id = $1 AND i.distributor_id = $2 AND i.deleted_at IS NULL
                GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email,
                         c.address_line1, c.city, c.state, c.postal_code,
                         o.order_id, o.order_number, o.delivery_date, o.status
            `;
            params = [id, distributor_id];
        }
        console.log('[getInvoice] Query:', query);
        console.log('[getInvoice] Params:', params);
        const result = await db.query(query, params);
        console.log('[getInvoice] Result length:', result.rows.length);
        if (result.rows.length === 0) {
            console.log('[getInvoice] No invoice found for id:', id);
            return res.status(404).json({ error: 'Invoice not found' });
        }
        const invoice = result.rows[0];
        if (!invoice.items || !Array.isArray(invoice.items) || (invoice.items.length === 1 && invoice.items[0] === null)) {
            invoice.items = [];
        }
        res.json({ invoice: invoice });
    } catch (error) {
        console.error('[getInvoice] Error fetching invoice:', error, error.stack);
        res.status(500).json({ error: 'Failed to fetch invoice' });
    }
};

// Add getInvoiceByOrderId
const getInvoiceByOrderId = async (req, res) => {
  const { order_id } = req.params;
  try {
    const query = `
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
      WHERE i.order_id = $1 AND i.deleted_at IS NULL
      GROUP BY i.invoice_id
    `;
    const result = await db.query(query, [order_id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Invoice not found for this order' });
    }
    const invoice = result.rows[0];
    if (!invoice.items || !Array.isArray(invoice.items) || (invoice.items.length === 1 && invoice.items[0] === null)) {
      invoice.items = [];
    }
    res.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice by order_id:', error);
    res.status(500).json({ error: 'Failed to fetch invoice', details: error.message });
  }
};

// Add getInvoiceById
const getInvoiceById = async (req, res) => {
  const { invoice_id } = req.params;
  try {
    const query = `
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
      WHERE i.invoice_id = $1 AND i.deleted_at IS NULL
      GROUP BY i.invoice_id
    `;
    const result = await db.query(query, [invoice_id]);
    if (!result.rows.length) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const invoice = result.rows[0];
    if (!invoice.items || !Array.isArray(invoice.items) || (invoice.items.length === 1 && invoice.items[0] === null)) {
      invoice.items = [];
    }
    res.json({ invoice });
  } catch (error) {
    console.error('Error fetching invoice by invoice_id:', error);
    res.status(500).json({ error: 'Failed to fetch invoice', details: error.message });
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
const raiseDispute = async (req, res) => {
    console.log('User Info (raiseDispute):', req.user);
    const { id } = req.params;
    const userId = getEffectiveUserId(req.user);
    if (!req.user || !userId) {
        return res.status(401).json({ error: 'User authentication required to raise dispute' });
    }
    const { role, distributor_id } = req.user;
    const { reason, dispute_type, disputed_amount, disputed_quantities, description } = req.body;

    if (!reason || !dispute_type) {
        return res.status(400).json({ error: 'Reason and dispute type are required' });
    }

    try {
        // Check if invoice exists and belongs to distributor (or is accessible by super admin)
        let invoiceQuery, invoiceParams;
        if (role === 'super_admin') {
            invoiceQuery = `
                SELECT invoice_id, distributor_id FROM invoices 
                WHERE invoice_id = $1 AND deleted_at IS NULL
            `;
            invoiceParams = [id];
        } else {
            invoiceQuery = `
                SELECT invoice_id, distributor_id FROM invoices 
                WHERE invoice_id = $1 AND distributor_id = $2 AND deleted_at IS NULL
            `;
            invoiceParams = [id, distributor_id];
        }
        const invoiceResult = await db.query(invoiceQuery, invoiceParams);
        
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];
        const effectiveDistributorId = role === 'super_admin' ? invoice.distributor_id : distributor_id;

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
            id, userId, reason, 'pending', dispute_type, disputed_amount || null, disputed_quantities ? JSON.stringify(disputed_quantities) : null, description || null
        ]);

        // If quantity dispute, create pending manual inventory adjustments
        if (dispute_type === 'quantity' && disputed_quantities) {
            for (const [cylinder_type_id, qty] of Object.entries(disputed_quantities || {})) {
                const adjustmentQuery = `
                    INSERT INTO manual_inventory_adjustments (
                        distributor_id, cylinder_type_id, adjusted_by,
                        adjustment_type, quantity, reason, status,
                        reference_type, reference_id
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                `;
                await db.query(adjustmentQuery, [
                    effectiveDistributorId, cylinder_type_id, userId,
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
const issueCreditNote = async (req, res) => {
    console.log('User Info (issueCreditNote):', req.user);
    const { id } = req.params;
    const userId = getEffectiveUserId(req.user);
    const { role, distributor_id } = req.user;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
        return res.status(400).json({ error: 'Amount and reason are required' });
    }
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
        return res.status(400).json({ error: 'Amount must be a positive number' });
    }
    if (!req.user || !userId) {
        return res.status(401).json({ error: 'User authentication required to issue credit note' });
    }

    try {
        // Check if invoice exists and belongs to distributor (or is accessible by super admin)
        let invoiceQuery, invoiceParams;
        if (role === 'super_admin') {
            invoiceQuery = `
                SELECT invoice_id, total_amount FROM invoices 
                WHERE invoice_id = $1 AND deleted_at IS NULL
            `;
            invoiceParams = [id];
        } else {
            invoiceQuery = `
                SELECT invoice_id, total_amount FROM invoices 
                WHERE invoice_id = $1 AND distributor_id = $2 AND deleted_at IS NULL
            `;
            invoiceParams = [id, distributor_id];
        }
        const invoiceResult = await db.query(invoiceQuery, invoiceParams);
        
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
        const creditNoteResult = await db.query(creditNoteQuery, [id, amount, reason, userId]);

        // GST API sync
        const gstResult = await syncWithGSTSite('credit_note', creditNoteResult.rows[0]);
        if (!gstResult.success) {
            await db.query('ROLLBACK');
            return res.status(500).json({ error: 'Failed to sync credit note with GST site', details: gstResult.error });
        }
        // Store GST document URL/reference
        await db.query('UPDATE credit_notes SET gst_document_url = $1 WHERE credit_note_id = $2', [gstResult.gst_url, creditNoteResult.rows[0].credit_note_id]);

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
const cancelInvoice = async (req, res) => {
    console.log('User Info (cancelInvoice):', req.user);
    const { id } = req.params;
    const userId = getEffectiveUserId(req.user);
    if (!req.user || !userId) {
        return res.status(401).json({ error: 'User authentication required to cancel invoice' });
    }
    const { role, distributor_id } = req.user;

    try {
        // Check if invoice exists and can be cancelled
        let invoiceQuery, invoiceParams;
        if (role === 'super_admin') {
            invoiceQuery = `
                SELECT i.*, 
                       json_agg(
                           json_build_object(
                               'cylinder_type_id', ii.cylinder_type_id,
                               'quantity', ii.quantity
                           )
                       ) as items
                FROM invoices i
                LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
                WHERE i.invoice_id = $1 AND i.deleted_at IS NULL
                GROUP BY i.invoice_id
            `;
            invoiceParams = [id];
        } else {
            invoiceQuery = `
                SELECT i.*, 
                       json_agg(
                           json_build_object(
                               'cylinder_type_id', ii.cylinder_type_id,
                               'quantity', ii.quantity
                           )
                       ) as items
                FROM invoices i
                LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
                WHERE i.invoice_id = $1 AND i.distributor_id = $2 AND i.deleted_at IS NULL
                GROUP BY i.invoice_id
            `;
            invoiceParams = [id, distributor_id];
        }
        const invoiceResult = await db.query(invoiceQuery, invoiceParams);
        
        if (invoiceResult.rows.length === 0) {
            return res.status(404).json({ error: 'Invoice not found' });
        }

        const invoice = invoiceResult.rows[0];
        const effectiveDistributorId = role === 'super_admin' ? invoice.distributor_id : distributor_id;

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
                effectiveDistributorId, item.cylinder_type_id, userId,
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
const updateInvoiceStatuses = async (req, res) => {
    const { role, distributor_id } = req.user;

    try {
        let overdueQuery, overdueCountQuery, params;
        
        if (role === 'super_admin') {
            // Update overdue invoices for all distributors
            overdueQuery = `
                UPDATE invoices 
                SET status = 'overdue'
                WHERE status IN ('issued', 'partially_paid')
                  AND due_date < CURRENT_DATE
            `;
            overdueCountQuery = `
                SELECT COUNT(*) as count
                FROM invoices 
                WHERE status = 'overdue'
            `;
            params = [];
        } else {
            // Update overdue invoices for specific distributor
            overdueQuery = `
                UPDATE invoices 
                SET status = 'overdue'
                WHERE distributor_id = $1 
                  AND status IN ('issued', 'partially_paid')
                  AND due_date < CURRENT_DATE
            `;
            overdueCountQuery = `
                SELECT COUNT(*) as count
                FROM invoices 
                WHERE distributor_id = $1 AND status = 'overdue'
            `;
            params = [distributor_id];
        }
        
        const overdueResult = await db.query(overdueQuery, params);
        const overdueCountResult = await db.query(overdueCountQuery, params);

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
const getAllInvoices = async (req, res) => {
    try {
        const { role } = req.user;
        let { distributor_id } = req.user;
        if (role === 'super_admin') {
            distributor_id = req.query.distributor_id;
            if (!distributor_id) {
                return res.status(400).json({ error: 'Super admin must select a distributor first.' });
            }
        }
        // Only check for missing distributor_id
        if (!distributor_id) {
            return res.status(400).json({ error: 'Invalid distributor_id in request.' });
        }
        const { status, customer_id, page = 1, limit = 10 } = req.query;

        let whereClause = '';
        let paramCount = 0;
        let params = [];

        paramCount++;
        whereClause = 'WHERE i.distributor_id = $1';
        params.push(distributor_id);

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
        let query;
        // Always append limit and offset to params
        params.push(limit, offset);
        if (role === 'super_admin') {
            query = `
                SELECT i.*, 
                       c.business_name, c.contact_person,
                       COALESCE(
                           (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                           0
                       ) as total_credits,
                       (i.total_amount - COALESCE(
                           (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                           0
                       )) as outstanding_amount,
                       json_agg(
                         json_build_object(
                           'invoice_item_id', ii.invoice_item_id,
                           'cylinder_type_id', ii.cylinder_type_id,
                           'quantity', ii.quantity,
                           'unit_price', ii.unit_price,
                           'discount_per_unit', ii.discount_per_unit,
                           'total_price', ii.total_price
                         )
                       ) as items
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.customer_id
                LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
                ${whereClause}
                GROUP BY i.invoice_id, c.business_name, c.contact_person
                ORDER BY i.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;
        } else {
            query = `
                SELECT i.*, 
                       c.business_name, c.contact_person,
                       COALESCE(
                           (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                           0
                       ) as total_credits,
                       (i.total_amount - COALESCE(
                           (SELECT SUM(amount) FROM credit_notes WHERE invoice_id = i.invoice_id),
                           0
                       )) as outstanding_amount,
                       json_agg(
                         json_build_object(
                           'invoice_item_id', ii.invoice_item_id,
                           'cylinder_type_id', ii.cylinder_type_id,
                           'quantity', ii.quantity,
                           'unit_price', ii.unit_price,
                           'discount_per_unit', ii.discount_per_unit,
                           'total_price', ii.total_price
                         )
                       ) as items
                FROM invoices i
                LEFT JOIN customers c ON i.customer_id = c.customer_id
                LEFT JOIN invoice_items ii ON i.invoice_id = ii.invoice_id
                ${whereClause}
                GROUP BY i.invoice_id, c.business_name, c.contact_person
                ORDER BY i.created_at DESC
                LIMIT $${paramCount} OFFSET $${paramCount + 1}
            `;
        }

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

const downloadInvoicePdf = async (req, res) => {
  const { id } = req.params;
  const { role, distributor_id } = req.user;
  try {
    // Fetch invoice details
    let query, params;
    
    if (role === 'super_admin') {
      query = `
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
        WHERE i.invoice_id = $1 AND i.deleted_at IS NULL
        GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email, c.gstin,
                 c.address_line1, c.address_line2, c.city, c.state, c.postal_code
      `;
      params = [id];
    } else {
      query = `
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
        WHERE i.invoice_id = $1 AND i.distributor_id = $2 AND i.deleted_at IS NULL
        GROUP BY i.invoice_id, c.business_name, c.contact_person, c.phone, c.email, c.gstin,
                 c.address_line1, c.address_line2, c.city, c.state, c.postal_code
      `;
      params = [id, distributor_id];
    }
    
    const result = await db.query(query, params);
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
    // Add any additional PDF content here as needed
    doc.end();
  } catch (error) {
    console.error('Error generating invoice PDF:', error);
    res.status(500).json({ error: 'Failed to generate invoice PDF' });
  }
};

// Add checkMultipleInvoices
const checkMultipleInvoices = async (req, res) => {
  const { order_ids } = req.body;
  const { role, distributor_id } = req.user;

  if (!Array.isArray(order_ids) || order_ids.length === 0) {
    return res.status(400).json({ error: 'order_ids must be a non-empty array' });
  }

  try {
    // First, get order statuses to determine if they can generate invoices
    let orderQuery, orderParams;
    if (role === 'super_admin') {
      orderQuery = `
        SELECT order_id, status
        FROM orders
        WHERE order_id = ANY($1)
      `;
      orderParams = [order_ids];
    } else {
      orderQuery = `
        SELECT order_id, status
        FROM orders
        WHERE order_id = ANY($1) AND distributor_id = $2
      `;
      orderParams = [order_ids, distributor_id];
    }
    const orderResult = await db.query(orderQuery, orderParams);

    // Create a map of order statuses
    const orderStatusMap = {};
    orderResult.rows.forEach(row => {
      orderStatusMap[row.order_id] = row.status;
    });

    // Then, get existing invoices
    let invoiceQuery, invoiceParams;
    if (role === 'super_admin') {
      invoiceQuery = `
        SELECT order_id, invoice_id, status
        FROM invoices
        WHERE order_id = ANY($1) AND deleted_at IS NULL
      `;
      invoiceParams = [order_ids];
    } else {
      invoiceQuery = `
        SELECT order_id, invoice_id, status
        FROM invoices
        WHERE order_id = ANY($1) AND distributor_id = $2 AND deleted_at IS NULL
      `;
      invoiceParams = [order_ids, distributor_id];
    }
    const invoiceResult = await db.query(invoiceQuery, invoiceParams);

    // Create a map of existing invoices
    const invoiceMap = {};
    invoiceResult.rows.forEach(row => {
      invoiceMap[row.order_id] = { invoice_id: row.invoice_id, status: row.status };
    });

    // Build the response with proper structure
    const map = {};
    for (const orderId of order_ids) {
      const orderStatus = orderStatusMap[orderId];
      const existingInvoice = invoiceMap[orderId];

      if (existingInvoice) {
        // Invoice already exists
        map[orderId] = {
          can_generate: false,
          order_status: orderStatus || 'unknown',
          existing_invoice: existingInvoice.invoice_id,
          message: 'Invoice already exists'
        };
      } else if (orderStatus === 'delivered' || orderStatus === 'modified delivered') {
        // Can generate invoice
        map[orderId] = {
          can_generate: true,
          order_status: orderStatus,
          existing_invoice: null,
          message: 'Ready to generate invoice'
        };
      } else {
        // Cannot generate invoice
        map[orderId] = {
          can_generate: false,
          order_status: orderStatus || 'unknown',
          existing_invoice: null,
          message: `Order must be delivered to generate invoice (current status: ${orderStatus || 'unknown'})`
        };
      }
    }

    res.json(map);
  } catch (error) {
    console.error('Error in checkMultipleInvoices:', error);
    res.status(500).json({ error: 'Failed to check invoices', details: error.message });
  }
};

// Credit Note Request
const creditNoteRequest = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.user_id || req.user.firebase_uid;
  try {
    await db.query(
      `UPDATE invoices SET status = 'pending_approval', credit_note_rejection_reason = NULL WHERE invoice_id = $1`,
      [id]
    );
    // Optionally log the request reason somewhere
    res.json({ success: true, message: 'Credit note request submitted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit credit note request', details: err.message });
  }
};

// Cancel Request
const cancelRequest = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.user_id || req.user.firebase_uid;
  try {
    await db.query(
      `UPDATE invoices SET status = 'pending_approval', cancel_rejection_reason = NULL WHERE invoice_id = $1`,
      [id]
    );
    // Optionally log the request reason somewhere
    res.json({ success: true, message: 'Cancel request submitted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to submit cancel request', details: err.message });
  }
};

// Approve Credit Note
const approveCreditNote = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id || req.user.firebase_uid;
  const now = new Date();
  try {
    // Call GST credit note IRN generation
    const gstResult = await generateCreditNoteIRN(id);
    if (gstResult.success) {
      await db.query(
        `UPDATE invoices SET status = 'credit_note_issued', einvoice_status = 'CREDIT_NOTE_SUCCESS', closed_at = $1, closed_by = $2, credit_note_rejection_reason = NULL WHERE invoice_id = $3`,
        [now, userId, id]
      );
      res.json({ success: true, message: 'Credit note approved and GST IRN generated' });
    } else {
      await db.query(
        `UPDATE invoices SET einvoice_status = 'FAILED', gst_error_message = $1 WHERE invoice_id = $2`,
        [gstResult.error, id]
      );
      res.status(500).json({ error: 'Failed to generate GST IRN for credit note', details: gstResult.error });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve credit note', details: err.message });
  }
};

// Reject Credit Note
const rejectCreditNote = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await db.query(
      `UPDATE invoices SET status = 'issued', credit_note_rejection_reason = $1 WHERE invoice_id = $2`,
      [reason, id]
    );
    res.json({ success: true, message: 'Credit note rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject credit note', details: err.message });
  }
};

// Approve Cancel
const approveCancel = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.user_id || req.user.firebase_uid;
  const now = new Date();
  const { reason } = req.body;
  try {
    // Call GST IRN cancel API
    const gstResult = await cancelIRN(id, reason);
    if (gstResult.success) {
      await db.query(
        `UPDATE invoices SET status = 'cancelled', einvoice_status = 'CANCELLED', closed_at = $1, closed_by = $2, cancel_rejection_reason = NULL WHERE invoice_id = $3`,
        [now, userId, id]
      );
      res.json({ success: true, message: 'Invoice cancelled and GST IRN cancelled' });
    } else {
      await db.query(
        `UPDATE invoices SET gst_error_message = $1 WHERE invoice_id = $2`,
        [gstResult.error, id]
      );
      res.status(500).json({ error: 'Failed to cancel GST IRN', details: gstResult.error });
    }
  } catch (err) {
    res.status(500).json({ error: 'Failed to approve cancel', details: err.message });
  }
};

// Reject Cancel
const rejectCancel = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  try {
    await db.query(
      `UPDATE invoices SET status = 'issued', cancel_rejection_reason = $1 WHERE invoice_id = $2`,
      [reason, id]
    );
    res.json({ success: true, message: 'Cancel request rejected' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reject cancel', details: err.message });
  }
};

// Generate IRN for an invoice
const generateIRNForInvoice = async (req, res) => {
  const invoice_id = req.params.id;
  try {
    // 1. Fetch invoice, distributor, customer, order_items, cylinder_types
    const invoiceResult = await db.query('SELECT * FROM invoices WHERE invoice_id = $1', [invoice_id]);
    if (!invoiceResult.rows.length) return res.status(404).json({ error: 'Invoice not found' });
    const invoice = invoiceResult.rows[0];
    const distributorResult = await db.query('SELECT * FROM distributors WHERE distributor_id = $1', [invoice.distributor_id]);
    if (!distributorResult.rows.length) return res.status(404).json({ error: 'Distributor not found' });
    const distributor = distributorResult.rows[0];
    const customerResult = await db.query('SELECT * FROM customers WHERE customer_id = $1', [invoice.customer_id]);
    if (!customerResult.rows.length) return res.status(404).json({ error: 'Customer not found' });
    const customer = customerResult.rows[0];
    const orderItemsResult = await db.query('SELECT * FROM order_items WHERE order_id = $1', [invoice.order_id]);
    const orderItems = orderItemsResult.rows;
    // TODO: Join cylinder_types for HSN/UOM if needed

    // 2. Build IRN payload dynamically (TODO: implement full mapping)
    const payload = {
      // TODO: Build full payload as per Masters India spec
      user_gstin: distributor.gstin,
      data_source: 'erp',
      // ...
    };

    // 3. Get valid JWT token for distributor
    let token = await tokenService.getToken(distributor.distributor_id);
    if (!token.startsWith('JWT ')) token = 'JWT ' + token;
    console.log('Masters India IRN Authorization header:', token);

    // 4. Call Masters India /einvoice/ endpoint
    const response = await axios.post(
      'https://sandb-api.mastersindia.co/api/v1/einvoice/',
      payload,
      {
        headers: {
          Authorization: token, // Always 'JWT <token>'
          'Content-Type': 'application/json',
        },
      }
    );
    const data = response.data;

    // 5. Store IRN, AckNo, AckDate, status, PDF, QRCode, etc. in the invoice
    await db.query(
      `UPDATE invoices SET irn = $1, ack_no = $2, ack_date = $3, status = 'issued', signed_qr = $4, invoice_pdf_url = $5 WHERE invoice_id = $6`,
      [data.Irn, data.AckNo, data.AckDt, data.QRCodeUrl, data.EinvoicePdf, invoice_id]
    );

    // 6. Return IRN response to client
    return res.json({ success: true, irn: data.Irn, ack_no: data.AckNo, ack_date: data.AckDt, response: data });
  } catch (error) {
    console.error('IRN generation error:', error.response?.data || error.message);
    return res.status(500).json({ error: error.response?.data || error.message });
  }
};

module.exports = {
  createInvoiceFromOrder,
  getInvoice,
  raiseDispute,
  issueCreditNote,
  cancelInvoice,
  updateInvoiceStatuses,
  getAllInvoices,
  downloadInvoicePdf,
  getInvoiceByOrderId,
  getInvoiceById,
  checkMultipleInvoices,
  creditNoteRequest,
  cancelRequest,
  approveCreditNote,
  rejectCreditNote,
  approveCancel,
  rejectCancel,
  generateIRNForInvoice
};
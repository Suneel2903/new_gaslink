const pool = require('../db.js');
const { createInvoiceFromOrder } = require('./invoiceController');

const createOrder = async (req, res) => {
  try {
    // Get distributor_id from req.user if not provided in body
    let { distributor_id, customer_id, delivery_date, delivery_address, delivery_time_slot, items } = req.body;
    if (!distributor_id && req.user && req.user.distributor_id) {
      distributor_id = req.user.distributor_id;
    }
    // Only require distributor_id, customer_id, delivery_date, items
    if (!distributor_id || !customer_id || !delivery_date || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    // Set defaults for optional fields
    if (!delivery_address) delivery_address = '';
    if (!delivery_time_slot) delivery_time_slot = '';

    // Validate distributor and customer
    const distCheck = await pool.query('SELECT 1 FROM distributors WHERE distributor_id = $1 AND deleted_at IS NULL', [distributor_id]);
    if (distCheck.rowCount === 0) return res.status(404).json({ error: 'Distributor not found' });
    const custCheck = await pool.query('SELECT 1 FROM customers WHERE customer_id = $1 AND distributor_id = $2 AND deleted_at IS NULL', [customer_id, distributor_id]);
    if (custCheck.rowCount === 0) return res.status(404).json({ error: 'Customer not found' });

    // Insert order
    const orderResult = await pool.query(
      `INSERT INTO orders (order_id, distributor_id, customer_id, order_number, order_date, delivery_date, delivery_address, delivery_time_slot, status, created_at)
       VALUES (gen_random_uuid(), $1, $2, 'ORD-' || to_char(NOW(), 'YYYYMMDDHH24MISS'), NOW(), $3, $4, $5, 'pending', NOW())
       RETURNING order_id`,
      [distributor_id, customer_id, delivery_date, delivery_address, delivery_time_slot]
    );
    const order_id = orderResult.rows[0].order_id;

    // Insert order items
    for (const item of items) {
      const { cylinder_type_id, quantity } = item;
      if (!cylinder_type_id || !quantity) continue;
      // Fetch price from cylinder_prices for delivery month/year
      const deliveryDateObj = new Date(delivery_date);
      const month = deliveryDateObj.getMonth() + 1;
      const year = deliveryDateObj.getFullYear();
      const priceResult = await pool.query(
        'SELECT unit_price FROM cylinder_prices WHERE cylinder_type_id = $1 AND month = $2 AND year = $3',
        [cylinder_type_id, month, year]
      );
      let unit_price = priceResult.rows[0]?.unit_price || 0;
      // Fetch per-cylinder discount for this customer and cylinder type
      const discountResult = await pool.query(
        'SELECT per_cylinder_discount FROM customer_cylinder_discounts WHERE customer_id = $1 AND cylinder_type_id = $2',
        [customer_id, cylinder_type_id]
      );
      let discount_per_unit = discountResult.rows[0]?.per_cylinder_discount;
      if (discount_per_unit === undefined) {
        // Fallback to flat customer discount if per-cylinder not found
        const flatDiscountResult = await pool.query(
          'SELECT discount FROM customers WHERE customer_id = $1',
          [customer_id]
        );
        discount_per_unit = flatDiscountResult.rows[0]?.discount || 0;
        console.warn(`[OrderController] No per-cylinder discount found for customer ${customer_id}, cylinder ${cylinder_type_id}. Falling back to flat discount.`);
      }
      const effective_unit_price = Math.max(unit_price - discount_per_unit, 0);
      const total_price = effective_unit_price * quantity;
      // Add debug log
      console.log(
        `Order item: cylinder_type_id=${cylinder_type_id}, quantity=${quantity}, unit_price=${unit_price}, discount_per_unit=${discount_per_unit}, effective_unit_price=${effective_unit_price}, total_price=${total_price}`
      );
      await pool.query(
        `INSERT INTO order_items (order_item_id, order_id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
        [order_id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price]
      );
    }

    return res.status(201).json({ order_id });
  } catch (err) {
    console.error('Create order error:', err);
    res.status(500).json({ error: 'Failed to create order' });
  }
};

const updateOrderStatus = async (req, res) => {
  const { id } = req.params;
  const { status, delivered_quantities, empties_collected } = req.body;
  const user = req.user;

  if (!id || !status) {
    return res.status(400).json({ error: 'Order ID and new status are required.' });
  }

  try {
    // Validate order exists
    const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Restrict distributor_admin to their own distributor's orders
    // Super_admin can update orders from any distributor
    if (user.role === 'distributor_admin' && orderRows[0].distributor_id !== user.distributor_id) {
      return res.status(403).json({ error: 'Forbidden: Cannot update orders for other distributors.' });
    }

    // Start transaction
    await pool.query('BEGIN');

    // Update order status
    await pool.query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2',
      [status, id]
    );

    // Log status change
    await pool.query(
      `INSERT INTO order_status_log (order_id, previous_status, new_status, changed_by, changed_at, notes)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [id, orderRows[0].status, status, user.user_id, 'Status updated via API']
    );

    // If this is a delivery and we have delivery data, update order items
    if (status === 'delivered' && (delivered_quantities || empties_collected)) {
      console.log('🔍 Updating delivery data for order:', id);
      console.log('🔍 Delivered quantities:', delivered_quantities);
      console.log('🔍 Empties collected:', empties_collected);
      console.log('🔍 Full request body:', req.body);

      // Get all order items for this order
      const itemsResult = await pool.query(
        'SELECT order_item_id, cylinder_type_id FROM order_items WHERE order_id = $1',
        [id]
      );

      // Update each order item with delivery data
      for (const item of itemsResult.rows) {
        const delivered_qty = delivered_quantities?.[item.cylinder_type_id] || null;
        const empties_qty = empties_collected?.[item.cylinder_type_id] || 0;

        await pool.query(
          `UPDATE order_items 
           SET delivered_quantity = $1, empties_collected = $2, updated_at = NOW()
           WHERE order_item_id = $3`,
          [delivered_qty, empties_qty, item.order_item_id]
        );

        console.log(`🔍 Updated item ${item.cylinder_type_id}: delivered=${delivered_qty}, empties=${empties_qty}`);
      }
    }

    await pool.query('COMMIT');

    // Audit log
    console.log(`Order ${id} status updated to ${status} by user ${user.user_id || user.firebase_uid} (${user.role})`);

    // Auto-create invoice if delivered or modified delivered
    if (['delivered', 'modified delivered'].includes(status)) {
      try {
        // Check if invoice already exists
        const invoiceCheck = await pool.query('SELECT 1 FROM invoices WHERE order_id = $1', [id]);
        if (invoiceCheck.rowCount === 0) {
          console.log('[orderController] Triggering createInvoiceFromOrder for order_id:', id);
          // Call createInvoiceFromOrder (simulate req/res for internal call)
          const fakeReq = { params: { order_id: id }, user };
          const fakeRes = {
            status: () => ({ json: () => {} }),
            json: () => {},
          };
          await createInvoiceFromOrder(fakeReq, fakeRes, { auto: true });
        } else {
          console.log('[orderController] Invoice already exists for order_id:', id);
        }
      } catch (err) {
        console.error('Auto-invoice creation failed:', err);
      }
    }

    return res.json({ success: true, order_id: id, new_status: status });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating order status:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

const listOrders = async (req, res) => {
  try {
    const { role } = req.user;
    let { distributor_id } = req.user;
    // For super_admin, allow distributor_id from query
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
    let ordersResult;
    ordersResult = await pool.query(`
      SELECT o.order_id, o.order_number, o.status, o.delivery_date, o.created_at, o.customer_id,
             c.business_name AS customer_name, c.discount
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.customer_id
      WHERE o.distributor_id = $1 AND o.deleted_at IS NULL
      ORDER BY o.created_at DESC
    `, [distributor_id]);
    const orders = ordersResult.rows;
    const orderIds = orders.map(o => o.order_id);
    // 2. Get all items for these orders, join cylinder_types
    const itemsResult = await pool.query(`
      SELECT oi.order_id, oi.cylinder_type_id, ct.name, ct.capacity_kg, oi.quantity, oi.delivered_quantity, oi.empties_collected, oi.order_item_id
      FROM order_items oi
      LEFT JOIN cylinder_types ct ON oi.cylinder_type_id = ct.cylinder_type_id
      WHERE oi.order_id = ANY($1)
    `, [orderIds]);
    // 3. Build a map: { [order_id]: [items...] }
    const itemsByOrder = {};
    for (const item of itemsResult.rows) {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      // Ensure delivered_quantity and empties_collected are numbers or null
      itemsByOrder[item.order_id].push({
        ...item,
        quantity: Number(item.quantity),
        delivered_quantity: item.delivered_quantity !== null && item.delivered_quantity !== undefined ? Number(item.delivered_quantity) : null,
        empties_collected: item.empties_collected !== null && item.empties_collected !== undefined ? Number(item.empties_collected) : 0,
        order_item_id: item.order_item_id
      });
    }
    // 4. For each order, fetch prices for the delivery month/year and calculate total
    const ordersWithItems = [];
    for (const order of orders) {
      const items = itemsByOrder[order.order_id] || [];
      const deliveryDate = new Date(order.delivery_date);
      const month = deliveryDate.getMonth() + 1;
      const year = deliveryDate.getFullYear();
      // Fetch prices for this month/year
      const priceRows = await pool.query(
        `SELECT cylinder_type_id, unit_price FROM cylinder_prices WHERE month = $1 AND year = $2`,
        [month, year]
      );
      const priceMap = {};
      priceRows.rows.forEach(row => {
        priceMap[row.cylinder_type_id] = parseFloat(row.unit_price);
      });
      const discount = Number(order.discount) || 0;
      let total_amount = 0;
      let total_quantity = 0;
      let isModified = false;
      const cleanItems = items.map(i => {
        const unit_price = priceMap[i.cylinder_type_id];
        if (unit_price === undefined) {
          console.warn(`⚠️ Price missing for cylinder_type_id=${i.cylinder_type_id} for month=${month}, year=${year}`);
        }
        // Use delivered_quantity if status is delivered, else quantity
        let usedQty = i.quantity;
        if (order.status === 'delivered' && i.delivered_quantity !== null && i.delivered_quantity !== undefined) {
          usedQty = i.delivered_quantity;
        }
        if (order.status === 'delivered' && i.delivered_quantity !== null && i.delivered_quantity !== undefined && i.delivered_quantity !== i.quantity) {
          isModified = true;
        }
        const effective_price = Math.max((unit_price || 0) - discount, 0);
        const itemTotal = usedQty * effective_price;
        total_amount += itemTotal;
        total_quantity += usedQty;
        return {
          ...i,
          unit_price: unit_price || 0,
          discount,
          used_quantity: usedQty,
          order_item_id: i.order_item_id
        };
      });
      // Format items string: "5 Cylinders — 19KG × 2, 47.5KG × 3"
      const items_display = total_quantity > 0
        ? `${total_quantity} Cylinders — ${cleanItems.map(i => `${parseFloat(i.capacity_kg)}KG × ${i.used_quantity}`).join(', ')}`
        : '';
      // Status override for modified delivered
      let status = order.status;
      if (order.status === 'delivered' && isModified) {
        status = 'modified delivered';
      }
      ordersWithItems.push({
        ...order,
        status,
        items: cleanItems.map(i => ({
          cylinder_type_id: i.cylinder_type_id,
          name: i.name,
          capacity_kg: i.capacity_kg,
          quantity: i.quantity,
          delivered_quantity: i.delivered_quantity,
          empties_collected: i.empties_collected,
          unit_price: i.unit_price,
          discount: i.discount,
          order_item_id: i.order_item_id
        })),
        items_display,
        total_quantity,
        discount,
        total_amount: Number(total_amount.toFixed(2))
      });
    }
    res.json(ordersWithItems);
  } catch (err) {
    console.error("❌ listOrders error", err);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { distributor_id } = req.user;
    
    console.log('🔄 Cancelling order:', id);

    // Start transaction
    await client.query('BEGIN');

    // 1. Get order details and check if it can be cancelled
    const orderResult = await client.query(
      `SELECT o.*, oi.cylinder_type_id, oi.quantity, oi.order_item_id
       FROM orders o
       JOIN order_items oi ON o.order_id = oi.order_id
       WHERE o.order_id = $1 AND o.status NOT IN ('delivered', 'cancelled')`,
      [id]
    );
    
    if (orderResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Order not found or cannot be cancelled' });
    }

    const order = orderResult.rows[0];
    const orderItems = orderResult.rows;

    // 2. Only handle vehicle inventory if order was dispatched
    if (order.status === 'dispatched') {
      console.log('📦 Order was dispatched, handling vehicle inventory for cancelled cylinders');

      // 3. For each order item, move cylinders to vehicle cancelled stock
      for (const item of orderItems) {
        const { cylinder_type_id, quantity } = item;
        
        // Check if vehicle is assigned to this order
        if (order.vehicle_id) {
          console.log(`🚚 Moving ${quantity} cylinders of type ${cylinder_type_id} to vehicle ${order.vehicle_id}`);
          
          // Update or insert vehicle inventory record
          const upsertQuery = `
            INSERT INTO vehicle_inventory (distributor_id, vehicle_id, cylinder_type_id, cancelled_order_quantity, updated_at)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4, NOW())
            ON CONFLICT (vehicle_id, cylinder_type_id)
            DO UPDATE SET 
              cancelled_order_quantity = vehicle_inventory.cancelled_order_quantity + $4,
              updated_at = NOW()
          `;
          
          await client.query(upsertQuery, [distributor_id, order.vehicle_id, cylinder_type_id, quantity]);

          // Insert audit log
          const logQuery = `
            INSERT INTO vehicle_cancelled_stock_log (order_id, vehicle_id, cylinder_type_id, quantity)
            VALUES ($1::uuid, $2::uuid, $3::uuid, $4)
          `;
          
          await client.query(logQuery, [id, order.vehicle_id, cylinder_type_id, quantity]);
        }
      }

      // 4. Mark order as having cancelled cylinders in vehicle
      await client.query(
        `UPDATE orders 
         SET status = 'cancelled', 
             cancelled_cylinders_to_vehicle = TRUE,
             updated_at = NOW()
         WHERE order_id = $1`,
        [id]
      );
    } else {
      // 5. For non-dispatched orders, just cancel normally
      await client.query(
        `UPDATE orders 
         SET status = 'cancelled', 
             updated_at = NOW()
         WHERE order_id = $1`,
        [id]
      );
    }

    // Log status change
    await client.query(
      `INSERT INTO order_status_log (order_id, previous_status, new_status, changed_by, changed_at, notes)
       VALUES ($1, $2, $3, $4, NOW(), $5)`,
      [id, order.status, 'cancelled', user.user_id, 'Order cancelled via API']
    );

    // Commit transaction
    await client.query('COMMIT');
    
    console.log('✅ Order cancelled successfully:', id);
    res.json({ 
      success: true, 
      order_id: id, 
      status: 'cancelled',
      cancelled_cylinders_to_vehicle: order.status === 'dispatched'
    });

  } catch (err) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('❌ Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order', details: err.message });
  } finally {
    client.release();
  }
};

const checkInvoiceGeneration = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, distributor_id } = req.user;

    // Check if order exists and is delivered
    let orderQuery, orderParams;
    if (role === 'super_admin') {
      // Super_admin can check any order
      orderQuery = `SELECT o.order_id, o.status, o.order_number, o.distributor_id
                    FROM orders o
                    WHERE o.order_id = $1 AND o.deleted_at IS NULL`;
      orderParams = [id];
    } else {
      // Regular users can only check their distributor's orders
      orderQuery = `SELECT o.order_id, o.status, o.order_number, o.distributor_id
                    FROM orders o
                    WHERE o.order_id = $1 AND o.distributor_id = $2 AND o.deleted_at IS NULL`;
      orderParams = [id, distributor_id];
    }

    const orderResult = await pool.query(orderQuery, orderParams);

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];
    const orderDistributorId = order.distributor_id;

    // Check if invoice already exists
    const invoiceResult = await pool.query(
      `SELECT invoice_id FROM invoices 
       WHERE order_id = $1 AND distributor_id = $2`,
      [id, orderDistributorId]
    );

    const canGenerate = order.status === 'delivered' && invoiceResult.rowCount === 0;
    const existingInvoice = invoiceResult.rows[0];

    res.json({
      can_generate: canGenerate,
      order_status: order.status,
      existing_invoice: existingInvoice ? existingInvoice.invoice_id : null,
      message: canGenerate 
        ? 'Invoice can be generated' 
        : order.status !== 'delivered' 
          ? 'Order must be delivered first' 
          : 'Invoice already exists for this order'
    });

  } catch (err) {
    console.error('Check invoice generation error:', err);
    res.status(500).json({ error: 'Failed to check invoice generation' });
  }
};

// Get a single order by ID
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { role, distributor_id } = req.user;
    
    let query, params;
    if (role === 'super_admin') {
      // Super_admin can view any order
      query = `SELECT * FROM orders WHERE order_id = $1 AND deleted_at IS NULL`;
      params = [id];
    } else {
      // Regular users can only view their distributor's orders
      query = `SELECT * FROM orders WHERE order_id = $1 AND distributor_id = $2 AND deleted_at IS NULL`;
      params = [id, distributor_id];
    }
    
    const orderResult = await pool.query(query, params);
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json(orderResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order', details: err.message });
  }
};

// Alias for listOrders
const getAllOrders = listOrders;

// Alias for updateOrderStatus
const updateOrder = async (req, res) => {
  const { id } = req.params;
  const { delivery_date, items } = req.body;
  const user = req.user;

  if (!id) {
    return res.status(400).json({ error: 'Order ID is required.' });
  }

  try {
    // Validate order exists and user has permission
    const { rows: orderRows } = await pool.query('SELECT * FROM orders WHERE order_id = $1', [id]);
    if (orderRows.length === 0) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const order = orderRows[0];

    // Restrict distributor_admin to their own distributor's orders
    // Super_admin can update orders from any distributor
    if (user.role === 'distributor_admin' && order.distributor_id !== user.distributor_id) {
      return res.status(403).json({ error: 'Forbidden: Cannot update orders for other distributors.' });
    }

    // Start transaction
    await pool.query('BEGIN');

    // Update order details if provided
    if (delivery_date) {
      await pool.query(
        'UPDATE orders SET delivery_date = $1, updated_at = NOW() WHERE order_id = $2',
        [delivery_date, id]
      );
    }

    // Update order items if provided
    if (Array.isArray(items) && items.length > 0) {
      // Delete existing items
      await pool.query('DELETE FROM order_items WHERE order_id = $1', [id]);

      // Insert new items
      for (const item of items) {
        const { cylinder_type_id, quantity } = item;
        if (!cylinder_type_id || !quantity) continue;

        // Fetch price from cylinder_prices for delivery month/year
        const deliveryDateObj = new Date(delivery_date || order.delivery_date);
        const month = deliveryDateObj.getMonth() + 1;
        const year = deliveryDateObj.getFullYear();
        const priceResult = await pool.query(
          'SELECT unit_price FROM cylinder_prices WHERE cylinder_type_id = $1 AND month = $2 AND year = $3',
          [cylinder_type_id, month, year]
        );
        let unit_price = priceResult.rows[0]?.unit_price || 0;

        // Fetch customer discount
        const discountResult = await pool.query(
          'SELECT discount FROM customers WHERE customer_id = $1',
          [order.customer_id]
        );
        const discount_per_unit = discountResult.rows[0]?.discount || 0;

        // Calculate effective price and total
        const effective_unit_price = Math.max(unit_price - discount_per_unit, 0);
        const total_price = effective_unit_price * quantity;

        await pool.query(
          `INSERT INTO order_items (order_item_id, order_id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price, created_at)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`,
          [id, cylinder_type_id, quantity, unit_price, discount_per_unit, total_price]
        );
      }
    }

    await pool.query('COMMIT');

    // Audit log
    console.log(`Order ${id} updated by user ${user.user_id || user.firebase_uid} (${user.role})`);

    return res.json({ success: true, order_id: id });
  } catch (err) {
    await pool.query('ROLLBACK');
    console.error('Error updating order:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
};

// Alias for cancelOrder
const deleteOrder = cancelOrder;

// Fulfill order (mark as delivered, minimal implementation)
const fulfillOrder = async (req, res) => {
  try {
    const { id } = req.params;
    // Mark order as delivered
    const orderResult = await pool.query(
      `UPDATE orders SET status = 'delivered', updated_at = NOW() WHERE order_id = $1 AND deleted_at IS NULL RETURNING *`,
      [id]
    );
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    res.json({ message: 'Order fulfilled', order: orderResult.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fulfill order', details: err.message });
  }
};

// List all orders for a customer
const getCustomerOrders = async (req, res) => {
  try {
    const { customer_id } = req.params;
    const { distributor_id } = req.user;
    const ordersResult = await pool.query(
      `SELECT * FROM orders WHERE customer_id = $1 AND distributor_id = $2 AND deleted_at IS NULL ORDER BY created_at DESC`,
      [customer_id, distributor_id]
    );
    res.json(ordersResult.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch customer orders', details: err.message });
  }
};

module.exports = {
  createOrder,
  updateOrderStatus,
  listOrders,
  cancelOrder,
  checkInvoiceGeneration,
  getOrder,
  getAllOrders,
  updateOrder,
  deleteOrder,
  fulfillOrder,
  getCustomerOrders
}; 
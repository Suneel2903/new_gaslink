import pool from '../db.js';

export const createOrder = async (req, res) => {
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
      // Fetch customer discount
      const discountResult = await pool.query(
        'SELECT discount FROM customers WHERE customer_id = $1',
        [customer_id]
      );
      const discount_per_unit = discountResult.rows[0]?.discount || 0;
      // Calculate effective price and total
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

export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, delivered_quantities, empties_collected } = req.body;
    if (!status) return res.status(400).json({ error: 'Missing status' });

    // Update order status
    const orderResult = await pool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE order_id = $2 RETURNING *`,
      [status, id]
    );
    if (orderResult.rowCount === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderResult.rows[0];

    // If delivered, update inventory and order_items
    if (status === 'delivered') {
      // Get all order items
      const itemsResult = await pool.query(
        `SELECT cylinder_type_id, quantity FROM order_items WHERE order_id = $1`,
        [id]
      );
      for (const item of itemsResult.rows) {
        // Update delivered_quantity and empties_collected if provided
        let deliveredQty = delivered_quantities?.[item.cylinder_type_id];
        let empties = empties_collected?.[item.cylinder_type_id];
        if (deliveredQty === undefined) deliveredQty = item.quantity;
        if (empties === undefined) empties = 0;
        deliveredQty = parseInt(deliveredQty, 10) || 0;
        empties = parseInt(empties, 10) || 0;
        await pool.query(
          `UPDATE order_items SET delivered_quantity = $1, empties_collected = $2, updated_at = NOW() WHERE order_id = $3 AND cylinder_type_id = $4`,
          [deliveredQty, empties, id, item.cylinder_type_id]
        );
        // Decrement full_quantity for each cylinder type in inventory
        await pool.query(
          `UPDATE inventory SET full_quantity = GREATEST(full_quantity - $1, 0), updated_at = NOW()
           WHERE distributor_id = $2 AND cylinder_type_id = $3`,
          [deliveredQty, order.distributor_id, item.cylinder_type_id]
        );
      }
    }
    // (Optional) If cancelled, restore stock if you implement reservation logic
    return res.json({ order });
  } catch (err) {
    console.error('Update order status error:', err);
    res.status(500).json({ error: 'Failed to update order status' });
  }
};

export const listOrders = async (req, res) => {
  try {
    const { distributor_id } = req.user;
    // 1. Get all orders with customer discount
    const ordersResult = await pool.query(`
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

export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    // Only allow cancelling if not already delivered or cancelled
    const orderResult = await pool.query(
      `UPDATE orders SET status = 'cancelled', updated_at = NOW()
       WHERE order_id = $1 AND status NOT IN ('delivered', 'cancelled')
       RETURNING *`,
      [id]
    );
    if (orderResult.rowCount === 0) return res.status(400).json({ error: 'Order not found or cannot be cancelled' });
    res.json({ order: orderResult.rows[0] });
  } catch (err) {
    console.error('Cancel order error:', err);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
};

export const checkInvoiceGeneration = async (req, res) => {
  try {
    const { id } = req.params;
    const { distributor_id } = req.user;

    // Check if order exists and is delivered
    const orderResult = await pool.query(
      `SELECT o.order_id, o.status, o.order_number
       FROM orders o
       WHERE o.order_id = $1 AND o.distributor_id = $2 AND o.deleted_at IS NULL`,
      [id, distributor_id]
    );

    if (orderResult.rowCount === 0) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const order = orderResult.rows[0];

    // Check if invoice already exists
    const invoiceResult = await pool.query(
      `SELECT invoice_id FROM invoices 
       WHERE order_id = $1 AND distributor_id = $2`,
      [id, distributor_id]
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
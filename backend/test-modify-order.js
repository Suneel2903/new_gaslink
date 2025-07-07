const pool = require('./db.js');

async function testModifyOrder() {
  try {
    // Find a delivered order to modify
    const orderResult = await pool.query(`
      SELECT o.order_id, oi.cylinder_type_id, oi.quantity
      FROM orders o
      JOIN order_items oi ON o.order_id = oi.order_id
      WHERE o.status = 'delivered'
      LIMIT 1
    `);
    
    if (orderResult.rows.length === 0) {
      console.log('No delivered orders found');
      return;
    }
    
    const order = orderResult.rows[0];
    console.log('Modifying order:', order.order_id);
    console.log('Original quantity:', order.quantity);
    
    // Set delivered_quantity to be different from quantity
    const deliveredQty = Math.max(1, order.quantity - 1); // Deliver one less than ordered
    
    await pool.query(`
      UPDATE order_items 
      SET delivered_quantity = $1, updated_at = NOW()
      WHERE order_id = $2 AND cylinder_type_id = $3
    `, [deliveredQty, order.order_id, order.cylinder_type_id]);
    
    console.log('Set delivered_quantity to:', deliveredQty);
    console.log('Order should now show as "modified delivered"');
    
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
  }
}

testModifyOrder(); 
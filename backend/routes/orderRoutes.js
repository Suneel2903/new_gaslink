const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  createOrder,
  getOrder,
  getAllOrders,
  updateOrder,
  deleteOrder,
  fulfillOrder,
  getCustomerOrders,
  updateOrderStatus
} = require('../controllers/orderController.js');

const router = express.Router();

router.use(verifyFirebaseToken);

// Admin actions: super_admin, distributor_admin
router.post('/', checkRole(['super_admin', 'distributor_admin', 'customer']), createOrder);
router.put('/:id', checkRole(['super_admin', 'distributor_admin']), updateOrder);
router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), deleteOrder);

// Fulfillment: inventory
router.post('/:id/fulfill', checkRole(['super_admin', 'inventory', 'distributor_admin']), fulfillOrder);

// Viewing: super_admin, distributor_admin, customer
router.get('/', checkRole(['super_admin', 'distributor_admin', 'customer']), getAllOrders);
router.get('/:id', checkRole(['super_admin', 'distributor_admin', 'customer']), getOrder);
router.get('/customer/:customer_id', checkRole(['super_admin', 'distributor_admin', 'customer']), getCustomerOrders);

// Allowed Roles per module:
// Orders: super_admin, distributor_admin
// Payments: super_admin, finance, distributor_admin
// Invoices: super_admin, finance, distributor_admin
// Inventory Fulfillment: super_admin, inventory, distributor_admin
router.patch('/:id/status', checkRole(['super_admin', 'distributor_admin']), updateOrderStatus);

module.exports = router;
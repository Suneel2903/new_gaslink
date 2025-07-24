const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const orderController = require('../controllers/orderController.js');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

router.use(verifyFirebaseToken);

// PATCH route for updating order status (must be before any dynamic :id routes)
router.patch('/:id/status', checkRole(['super_admin', 'distributor_admin']), orderController.updateOrderStatus);

// Assignment endpoints (must be before any dynamic :id routes)
router.post('/assignments', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.assignDriverToVehicle);
router.get('/assignments', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.listAssignmentsForDate);
router.patch('/assignments/:id/reconcile', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.reconcileAssignment);

// Admin actions: super_admin, distributor_admin
router.post('/', checkRole(['super_admin', 'distributor_admin', 'customer']), orderController.createOrder);
router.put('/:id', checkRole(['super_admin', 'distributor_admin']), orderController.updateOrder);
router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), orderController.deleteOrder);

// Fulfillment: inventory
router.post('/:id/fulfill', checkRole(['super_admin', 'inventory', 'distributor_admin']), orderController.fulfillOrder);

// Viewing: super_admin, distributor_admin, customer
router.get('/', checkRole(['super_admin', 'distributor_admin', 'customer']), orderController.getAllOrders);
router.get('/:id', checkRole(['super_admin', 'distributor_admin', 'customer']), orderController.getOrder);
router.get('/customer/:customer_id', checkRole(['super_admin', 'distributor_admin', 'customer']), orderController.getCustomerOrders);

module.exports = router;
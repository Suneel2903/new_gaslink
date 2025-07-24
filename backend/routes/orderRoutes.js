const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
// Named imports for all order controller functions
const {
  updateOrderStatus,
  updateOrder,
  deleteOrder,
  fulfillOrder,
  createOrder,
  getAllOrders,
  getOrder,
  getCustomerOrders
} = require('../controllers/orderController.js');
const assignmentController = require('../controllers/assignmentController');

const router = express.Router();

router.use(verifyFirebaseToken);

// Debug: log exported keys
console.log('🔍 orderController keys:', Object.keys(require('../controllers/orderController.js')));

// --- Action-prefixed PATCH/PUT/DELETE routes (safe, semantic) ---
router.patch('/status/:id', checkRole(['super_admin', 'distributor_admin']), updateOrderStatus);
router.put('/update/:id', checkRole(['super_admin', 'distributor_admin']), updateOrder);
router.delete('/delete/:id', checkRole(['super_admin', 'distributor_admin']), deleteOrder);
router.post('/fulfill/:id', checkRole(['super_admin', 'inventory', 'distributor_admin']), fulfillOrder);

// --- Deprecated legacy routes for backward compatibility (to be removed after migration) ---
// const orderController = require('../controllers/orderController.js'); // backup
// router.patch('/:id/status', checkRole(['super_admin', 'distributor_admin']), orderController.updateOrderStatus); // deprecated
// router.put('/:id', checkRole(['super_admin', 'distributor_admin']), orderController.updateOrder); // deprecated
// router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), orderController.deleteOrder); // deprecated
// router.post('/:id/fulfill', checkRole(['super_admin', 'inventory', 'distributor_admin']), orderController.fulfillOrder); // deprecated

// --- Assignment endpoints (safe) ---
console.log('🔍 assignmentController keys:', Object.keys(require('../controllers/assignmentController.js')));
console.log('🔍 typeof reconcileAssignment:', typeof assignmentController.reconcileAssignment);
router.post('/assignments', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.assignDriverToVehicle);
router.get('/assignments', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.listAssignmentsForDate);
router.patch('/assignments/:id/reconcile', checkRole(['super_admin', 'distributor_admin', 'inventory']), assignmentController.reconcileAssignment);

// --- Admin actions: super_admin, distributor_admin ---
router.post('/', checkRole(['super_admin', 'distributor_admin', 'customer']), createOrder);

// --- Viewing: super_admin, distributor_admin, customer ---
router.get('/', checkRole(['super_admin', 'distributor_admin', 'customer']), getAllOrders);
router.get('/customer/:customer_id', checkRole(['super_admin', 'distributor_admin', 'customer']), getCustomerOrders);
router.get('/:id', checkRole(['super_admin', 'distributor_admin', 'customer']), getOrder); // keep last

module.exports = router;
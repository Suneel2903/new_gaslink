const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  getAllCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerBalance,
  getCustomerInvoices,
  getCustomerOrders,
  getCustomerInventory
} = require('../controllers/customerController.js');

console.log("Customers route loaded");

const router = express.Router();

router.use(verifyFirebaseToken);

// Admin actions: super_admin, distributor_admin
router.post('/', checkRole(['super_admin', 'distributor_admin']), createCustomer);
router.put('/:id', checkRole(['super_admin', 'distributor_admin']), updateCustomer);
router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), deleteCustomer);

// Viewing: super_admin, distributor_admin, finance
router.get('/', checkRole(['super_admin', 'distributor_admin', 'finance']), getAllCustomers);
router.get('/:id', checkRole(['super_admin', 'distributor_admin', 'finance', 'customer']), getCustomer);
router.get('/:id/balance', checkRole(['super_admin', 'distributor_admin', 'finance', 'customer']), getCustomerBalance);
router.get('/:id/invoices', checkRole(['super_admin', 'distributor_admin', 'finance', 'customer']), getCustomerInvoices);
router.get('/:id/orders', checkRole(['super_admin', 'distributor_admin', 'finance', 'customer']), getCustomerOrders);
router.get('/:id/inventory', checkRole(['super_admin', 'distributor_admin', 'finance', 'customer']), getCustomerInventory);

// Test route to confirm router is loaded
router.get('/test', (req, res) => res.json({ message: 'Customers test route works' }));

module.exports = router; 
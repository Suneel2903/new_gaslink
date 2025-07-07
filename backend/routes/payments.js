const express = require('express');
const { authenticateUser } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  createPayment,
  getPayment,
  getAllPayments,
  updatePayment,
  deletePayment,
  getCustomerPayments,
  getOutstandingInvoices,
  getPaymentSummary
} = require('../controllers/paymentController.js');

const router = express.Router();

router.use(authenticateUser);

// Allowed Roles per module:
// Payments: super_admin, finance, distributor_admin

// Payment management: super_admin, finance
router.post('/', checkRole(['super_admin', 'finance', 'distributor_admin']), createPayment);
router.put('/:id', checkRole(['super_admin', 'finance', 'distributor_admin']), updatePayment);
router.delete('/:id', checkRole(['super_admin', 'finance', 'distributor_admin']), deletePayment);

// Viewing: super_admin, finance, customer
router.get('/', checkRole(['super_admin', 'finance', 'distributor_admin']), getAllPayments);
router.get('/:id', checkRole(['super_admin', 'finance', 'distributor_admin', 'customer']), getPayment);
router.get('/customer/:customer_id', checkRole(['super_admin', 'finance', 'distributor_admin', 'customer']), getCustomerPayments);

// Get outstanding invoices for customer (Admin, Finance)
router.get('/outstanding/:customerId', getOutstandingInvoices);

// Get payment summary/reports (Admin, Finance)
router.get('/summary/reports', getPaymentSummary);

module.exports = router; 
const express = require('express');
const { authenticateUser } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const { 
    createInvoiceFromOrder, 
    getInvoice, 
    raiseDispute, 
    issueCreditNote, 
    cancelInvoice, 
    updateInvoiceStatuses, 
    getAllInvoices,
    downloadInvoicePdf,
    getInvoiceByOrderId,
    getInvoiceById
} = require('../controllers/invoiceController.js');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateUser);

// Allowed Roles per module:
// Invoices: super_admin, finance, distributor_admin

// Invoice management: super_admin, finance
router.get('/', checkRole(['super_admin', 'finance', 'distributor_admin']), getAllInvoices);
router.get('/from-order/:order_id', checkRole(['super_admin', 'finance', 'distributor_admin']), getInvoiceByOrderId);
router.get('/:id/download', checkRole(['super_admin', 'finance', 'distributor_admin']), downloadInvoicePdf);
router.get('/:id', checkRole(['super_admin', 'finance', 'distributor_admin']), getInvoice);
router.post('/create-from-order/:order_id', checkRole(['super_admin', 'finance', 'distributor_admin']), createInvoiceFromOrder);
router.post('/:id/dispute', checkRole(['super_admin', 'finance', 'distributor_admin']), raiseDispute);
router.post('/:id/credit-note', checkRole(['super_admin', 'finance', 'distributor_admin']), issueCreditNote);
router.post('/:id/cancel', checkRole(['super_admin', 'finance', 'distributor_admin']), cancelInvoice);
router.post('/update-statuses', checkRole(['super_admin', 'finance', 'distributor_admin']), updateInvoiceStatuses);
router.post('/check-multiple', checkRole(['super_admin', 'finance', 'distributor_admin']), require('../controllers/invoiceController').checkMultipleInvoices);

module.exports = router; 
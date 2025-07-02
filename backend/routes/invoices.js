import express from 'express';
import { 
    createInvoiceFromOrder, 
    getInvoice, 
    raiseDispute, 
    issueCreditNote, 
    cancelInvoice, 
    updateInvoiceStatuses, 
    getAllInvoices,
    downloadInvoicePdf
} from '../controllers/invoiceController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(auth);

// Create invoice from delivered order
router.post('/create-from-order/:order_id', createInvoiceFromOrder);

// Get all invoices for distributor
router.get('/', getAllInvoices);

// Get specific invoice
router.get('/:id', getInvoice);

// Raise dispute on invoice
router.post('/:id/dispute', raiseDispute);

// Issue credit note for invoice
router.post('/:id/credit-note', issueCreditNote);

// Cancel invoice
router.post('/:id/cancel', cancelInvoice);

// Update invoice statuses (cron job endpoint)
router.post('/update-statuses', updateInvoiceStatuses);

// Add the download PDF route
router.get('/:id/download', downloadInvoicePdf);

export default router; 
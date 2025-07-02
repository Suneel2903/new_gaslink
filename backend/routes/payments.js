import express from 'express';
import { getAllPayments, getPaymentById, createPayment, getOutstandingInvoices, getPaymentSummary } from '../controllers/paymentController.js';
// import auth from '../middleware/auth.js'; // Temporarily disabled for testing

const router = express.Router();

// Apply auth middleware to all routes
// router.use(auth); // Temporarily disabled for testing

// Get all payments (Admin, Finance, Inventory - read only)
router.get('/', getAllPayments);

// Get payment by ID (Admin, Finance, Inventory - read only)
router.get('/:paymentId', getPaymentById);

// Create new payment (Admin, Finance)
router.post('/', createPayment);

// Get outstanding invoices for customer (Admin, Finance)
router.get('/outstanding/:customerId', getOutstandingInvoices);

// Get payment summary/reports (Admin, Finance)
router.get('/summary/reports', getPaymentSummary);

export default router; 
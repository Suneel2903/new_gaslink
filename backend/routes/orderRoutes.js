import express from 'express';
import { createOrder, updateOrderStatus, listOrders, cancelOrder, checkInvoiceGeneration } from '../controllers/orderController.js';
import authenticateUser from '../middleware/auth.js';

const router = express.Router();

// Test route
router.get('/ping', (req, res) => res.json({ message: 'Order API is live' }));

// Place order
router.post('/', authenticateUser, createOrder);

// Update order status
router.patch('/:id/status', authenticateUser, updateOrderStatus);

// List all orders
router.get('/', authenticateUser, listOrders);

// Cancel order
router.patch('/:id/cancel', authenticateUser, cancelOrder);

// Check if invoice can be generated for order
router.get('/:id/check-invoice', authenticateUser, checkInvoiceGeneration);

export default router; 
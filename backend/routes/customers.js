import express from 'express';
import {
  listCustomers,
  getCustomerById,
  addCustomer,
  updateCustomer,
  deactivateCustomer,
  setStopSupply,
  listModificationRequests,
  createModificationRequest,
  setPreferredDriver
} from '../controllers/customerController.js';
// import authenticateUser from '../middleware/auth.js'; // Temporarily disabled for testing

console.log("Customers route loaded");

const router = express.Router();

// Test route to confirm router is loaded
router.get('/test', (req, res) => res.json({ message: 'Customers test route works' }));

// List all customers
router.get('/', listCustomers); // authenticateUser temporarily disabled

// Get a single customer by ID
router.get('/:customer_id', getCustomerById); // authenticateUser temporarily disabled

// Add a new customer
router.post('/', addCustomer); // authenticateUser temporarily disabled

// Update customer details
router.put('/:customer_id', updateCustomer); // authenticateUser temporarily disabled

// Deactivate (soft delete) a customer
router.delete('/:customer_id', deactivateCustomer); // authenticateUser temporarily disabled

// Stop or resume supply to a customer
router.patch('/:customer_id/stop-supply', setStopSupply); // authenticateUser temporarily disabled

// List all customer modification requests
router.get('/modification/requests', listModificationRequests); // authenticateUser temporarily disabled

// Create a customer modification request
router.post('/modification/request', createModificationRequest); // authenticateUser temporarily disabled

// Assign or update preferred driver for a customer
router.patch('/:customer_id/preferred-driver', setPreferredDriver); // authenticateUser temporarily disabled

export default router; 
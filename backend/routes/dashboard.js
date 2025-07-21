const express = require('express');
const { getDashboardStats } = require('../controllers/dashboardController.js');
const { getPendingActions } = require('../controllers/pendingActionsController.js');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(verifyFirebaseToken);

// Dashboard stats endpoint
// Allowed roles: super_admin, distributor_admin, inventory, finance
router.get('/stats/:distributor_id', checkRole(['super_admin', 'distributor_admin', 'inventory', 'finance']), getDashboardStats);

// Pending actions endpoint
// Allowed roles: super_admin, distributor_admin, inventory, finance
router.get('/pending-actions/:distributor_id', checkRole(['super_admin', 'distributor_admin', 'inventory', 'finance']), getPendingActions);

module.exports = router; 
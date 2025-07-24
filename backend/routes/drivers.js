const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const availabilityController = require('../controllers/availabilityController');
const { verifyFirebaseToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// List all drivers
router.get('/', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), driverController.listDrivers);
// Create driver
router.post('/', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), driverController.createDriver);
// Update driver
router.patch('/:id', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), driverController.updateDriver);
// Deactivate/reactivate driver
router.patch('/:id', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), driverController.deactivateDriver);

// Driver availability endpoints
router.post('/availability/mark-unavailable', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.markUnavailable);
router.post('/availability/mark-available', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.markAvailable);
router.get('/availability/status', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.getAvailabilityStatus);

module.exports = router; 
const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const availabilityController = require('../controllers/availabilityController');
const { verifyFirebaseToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// CRUD endpoints for vehicles
router.get('/', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), vehicleController.listVehicles);
router.post('/', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), vehicleController.createVehicle);
router.patch('/:id', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), vehicleController.updateVehicle);
router.patch('/:id', verifyFirebaseToken, checkRole(['super_admin', 'admin', 'distributor_admin', 'inventory']), vehicleController.deactivateVehicle);

// Existing endpoints
router.get('/cancelled-stock/:distributor_id', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'distributor_admin', 'super_admin']), 
  vehicleController.getCancelledStockInVehicles
);

router.post('/cancelled-stock/move', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'super_admin']), 
  vehicleController.moveCancelledStockToInventory
);

router.get('/inventory-summary/:distributor_id', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'distributor_admin', 'super_admin']), 
  vehicleController.getVehicleInventorySummary
);

// Vehicle availability endpoints
router.post('/availability/mark-unavailable', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.markUnavailable);
router.post('/availability/mark-available', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.markAvailable);
router.get('/availability/status', verifyFirebaseToken, checkRole(['inventory', 'distributor_admin', 'super_admin']), availabilityController.getAvailabilityStatus);

module.exports = router; 
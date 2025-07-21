const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicleController');
const { verifyFirebaseToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// Get cancelled stock in vehicles for a distributor
router.get('/cancelled-stock/:distributor_id', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'distributor_admin', 'super_admin']), 
  vehicleController.getCancelledStockInVehicles
);

// Move cancelled stock from vehicle to depot inventory
router.post('/cancelled-stock/move', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'super_admin']), 
  vehicleController.moveCancelledStockToInventory
);

// Get vehicle inventory summary
router.get('/inventory-summary/:distributor_id', 
  verifyFirebaseToken, 
  checkRole(['inventory', 'distributor_admin', 'super_admin']), 
  vehicleController.getVehicleInventorySummary
);

module.exports = router; 
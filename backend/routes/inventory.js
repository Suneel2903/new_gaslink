const express = require('express');
const { getInventorySummary, upsertInventorySummary, approveInventoryAdjustment, updateFromDelivery, listReplenishments, updateReplenishmentStatus, confirmReturn, getCustomerInventorySummary, getUnaccountedSummary, lockSummary, unlockSummary, adminOverrideBalance, getInventoryHistory } = require('../controllers/inventoryController.js');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');

const router = express.Router();

router.use(verifyFirebaseToken);

// Allowed Roles per module:
// Inventory Fulfillment: super_admin, inventory, distributor_admin

// Inventory management: super_admin, inventory, distributor_admin
router.get('/summary/:date', checkRole(['super_admin', 'inventory', 'distributor_admin']), getInventorySummary);
router.post('/summary/:date', checkRole(['super_admin', 'inventory', 'distributor_admin']), upsertInventorySummary);
router.patch('/approve-adjustment', checkRole(['super_admin', 'inventory', 'distributor_admin']), approveInventoryAdjustment);
router.post('/update-from-delivery', checkRole(['super_admin', 'inventory', 'distributor_admin']), updateFromDelivery);
router.get('/replenishments', checkRole(['super_admin', 'inventory', 'distributor_admin']), listReplenishments);
router.patch('/replenishments/:id', checkRole(['super_admin', 'inventory', 'distributor_admin']), updateReplenishmentStatus);
router.post('/confirm-return', checkRole(['super_admin', 'inventory', 'distributor_admin']), confirmReturn);
router.get('/customer-summary/:customer_id', checkRole(['super_admin', 'inventory', 'distributor_admin']), getCustomerInventorySummary);
router.get('/unaccounted-summary', checkRole(['super_admin', 'inventory', 'distributor_admin']), getUnaccountedSummary);
router.patch('/lock-summary/:date', checkRole(['super_admin', 'inventory', 'distributor_admin']), lockSummary);
router.patch('/unlock-summary/:date', checkRole(['super_admin', 'inventory', 'distributor_admin']), unlockSummary);
router.patch('/admin-override-balance', checkRole(['super_admin', 'inventory', 'distributor_admin']), adminOverrideBalance);
router.get('/history/:customer_id/:cylinder_type_id', checkRole(['super_admin', 'inventory', 'distributor_admin']), getInventoryHistory);
router.get('/customer-delivery-history/:customer_id/:cylinder_type_id', checkRole(['super_admin', 'inventory', 'distributor_admin']), require('../controllers/inventoryController').getCustomerDeliveryHistory);

// Add new route for logging inventory unaccounted
router.post('/unaccounted-log', require('../controllers/inventoryController').logInventoryUnaccounted);
router.get('/unaccounted-log', require('../controllers/inventoryController').getInventoryUnaccountedLog);

module.exports = router; 
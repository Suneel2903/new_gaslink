const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController.js');
const { verifyFirebaseToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// Get cylinder thresholds for distributor
router.get('/cylinder-thresholds', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.getCylinderThresholds);
// Update cylinder thresholds for distributor
router.post('/cylinder-thresholds', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.updateCylinderThresholds);
// Get default due date settings (for reference) - must come before /:distributor_id
router.get('/defaults/due-dates', verifyFirebaseToken, settingsController.getDefaultDueDateSettings);
// Get distributor settings
router.get('/:distributor_id', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.getDistributorSettings);
// Update distributor settings
router.put('/:distributor_id', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.updateDistributorSettings);

module.exports = router; 
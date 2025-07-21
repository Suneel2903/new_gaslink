const express = require('express');
const router = express.Router();

const settingsController = require('../controllers/settingsController.js');
const { verifyFirebaseToken } = require('../middleware/auth');
const { checkRole } = require('../middleware/checkRole');

// Get default due date settings (for reference) - must come before /:distributor_id
router.get('/defaults/due-dates', verifyFirebaseToken, settingsController.getDefaultDueDateSettings);

// Get distributor settings
router.get('/:distributor_id', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.getDistributorSettings);

// Update distributor settings
router.put('/:distributor_id', verifyFirebaseToken, checkRole(['distributor_admin', 'super_admin']), settingsController.updateDistributorSettings);

module.exports = router; 
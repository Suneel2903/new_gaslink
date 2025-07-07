const express = require('express');
const { authenticateUser } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const { getAllCylinderPrices, createCylinderPrice, updateCylinderPrice, deleteCylinderPrice, upsertPrices } = require('../controllers/cylinderPriceController.js');

const router = express.Router();

router.use(authenticateUser);

// Only super_admin and distributor_admin can manage cylinder prices
router.get('/', checkRole(['super_admin', 'distributor_admin']), getAllCylinderPrices);
router.post('/', checkRole(['super_admin', 'distributor_admin']), upsertPrices);
router.put('/:id', checkRole(['super_admin', 'distributor_admin']), updateCylinderPrice);
router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), deleteCylinderPrice);

// Fetch cylinder prices for a specific month and year
router.get('/by-month', checkRole(['super_admin', 'distributor_admin']), require('../controllers/cylinderPriceController.js').getPricesByMonthYear);

module.exports = router; 
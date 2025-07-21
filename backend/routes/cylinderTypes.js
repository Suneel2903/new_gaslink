const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const { getAllCylinderTypes, createCylinderType, updateCylinderType, deleteCylinderType } = require('../controllers/cylinderTypeController.js');

const router = express.Router();

router.use(verifyFirebaseToken);

// Only super_admin and distributor_admin can manage cylinder types
router.get('/', checkRole(['super_admin', 'distributor_admin']), getAllCylinderTypes);
router.post('/', checkRole(['super_admin', 'distributor_admin']), createCylinderType);
router.put('/:id', checkRole(['super_admin', 'distributor_admin']), updateCylinderType);
router.delete('/:id', checkRole(['super_admin', 'distributor_admin']), deleteCylinderType);

module.exports = router; 
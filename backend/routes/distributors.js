const express = require('express');
const { authenticateUser } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  getAllDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor
} = require('../controllers/distributorController.js');

const router = express.Router();

router.use(authenticateUser);

// Only super_admin and distributor_admin can manage distributors
router.get('/', checkRole(['super_admin', 'distributor_admin']), getAllDistributors);
router.post('/', checkRole(['super_admin']), createDistributor);
router.put('/:id', checkRole(['super_admin']), updateDistributor);
router.delete('/:id', checkRole(['super_admin']), deleteDistributor);

module.exports = router; 
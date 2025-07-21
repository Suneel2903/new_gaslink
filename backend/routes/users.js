const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  getAllUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  setUserRole,
  getMyProfile
} = require('../controllers/userController.js');

const router = express.Router();

// Profile route should be defined before router.use for other auth
router.get('/profile/me', verifyFirebaseToken, getMyProfile);

router.use(verifyFirebaseToken);

// Only super_admin can manage users, distributor_admin can view
router.get('/', checkRole(['super_admin', 'distributor_admin']), getAllUsers);
router.get('/:id', checkRole(['super_admin', 'distributor_admin']), getUser);
router.post('/', checkRole(['super_admin']), createUser);
router.put('/:id', checkRole(['super_admin']), updateUser);
router.delete('/:id', checkRole(['super_admin']), deleteUser);
router.post('/:id/set-role', checkRole(['super_admin']), setUserRole);

module.exports = router; 
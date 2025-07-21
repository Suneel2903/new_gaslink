const express = require('express');
const { verifyFirebaseToken } = require('../middleware/auth.js');
const { checkRole } = require('../middleware/checkRole.js');
const {
  getAllDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor
} = require('../controllers/distributorController.js');
const pool = require('../db.js');

const router = express.Router();

router.use(verifyFirebaseToken);

// Only super_admin and distributor_admin can manage distributors
router.get('/', checkRole(['super_admin', 'distributor_admin']), getAllDistributors);
router.post('/', checkRole(['super_admin']), createDistributor);
router.put('/:id', checkRole(['super_admin']), updateDistributor);
router.delete('/:id', checkRole(['super_admin']), deleteDistributor);

// GET /api/distributors/all → returns all distributors (only for super_admin)
router.get('/all', checkRole(['super_admin']), async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT distributor_id AS id, business_name AS name FROM distributors WHERE deleted_at IS NULL ORDER BY business_name"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Failed to fetch distributors:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

module.exports = router; 
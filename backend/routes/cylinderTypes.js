import express from 'express';
import { listCylinderTypes, updateCylinderPrice } from '../controllers/cylinderTypeController.js';
import authenticateUser, { requireRole } from '../middleware/auth.js';

const router = express.Router();

router.get('/', listCylinderTypes);
router.patch('/:id/price', authenticateUser, requireRole(['admin', 'finance']), updateCylinderPrice);

export default router; 
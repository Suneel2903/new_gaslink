import express from 'express';
import { getInventorySummary, upsertInventorySummary, approveInventoryAdjustment, updateFromDelivery, listReplenishments, updateReplenishmentStatus, confirmReturn, getCustomerInventorySummary, getUnaccountedSummary, lockSummary, unlockSummary, adminOverrideBalance, getInventoryHistory } from '../controllers/inventoryController.js';
import auth from '../middleware/auth.js';

const router = express.Router();

// GET /inventory/summary/:date
router.get('/summary/:date', auth, getInventorySummary);
// POST /inventory/summary/:date
router.post('/summary/:date', auth, upsertInventorySummary);
router.patch('/approve-adjustment', auth, approveInventoryAdjustment);
router.post('/update-from-delivery', auth, updateFromDelivery);
router.get('/replenishments', auth, listReplenishments);
router.patch('/replenishments/:id', auth, updateReplenishmentStatus);
router.post('/confirm-return', auth, confirmReturn);
router.get('/customer-summary/:customer_id', auth, getCustomerInventorySummary);
router.get('/unaccounted-summary', auth, getUnaccountedSummary);
router.patch('/lock-summary/:date', auth, lockSummary);
router.patch('/unlock-summary/:date', auth, unlockSummary);
router.patch('/admin-override-balance', auth, adminOverrideBalance);
router.get('/history/:customer_id/:cylinder_type_id', getInventoryHistory);

export default router; 
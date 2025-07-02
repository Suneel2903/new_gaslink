import express from 'express';
import { getLatestPrices, upsertPrices, getPricesByMonthYear } from '../controllers/cylinderPriceController.js';
const router = express.Router();

router.get('/latest', getLatestPrices);
router.post('/', upsertPrices);
router.get('/by-month-year', getPricesByMonthYear);

export default router; 
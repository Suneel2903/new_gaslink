const express = require('express');
const router = express.Router();
const { generateIRN } = require('../services/gstService');

// POST /api/gst/generate/:invoice_id
router.post('/generate/:invoice_id', async (req, res) => {
  const { invoice_id } = req.params;
  try {
    const result = await generateIRN(invoice_id);
    console.log('GST IRN Generation Result:', result);
    res.json(result);
  } catch (err) {
    console.error('GST IRN Generation Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
// Manual test: Connect to Express app, POST to /api/gst/generate/:invoice_id, check logs and DB. 
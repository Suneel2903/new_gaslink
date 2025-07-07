const express = require('express');
const { processInvoice, handleIOCLUpload, handleGetCorporationInvoices, handleERVUpload, handleGetOutgoingERVs } = require('../controllers/ocrController.js');
const { authenticateUser } = require('../middleware/auth.js');
const multer = require('multer');
const path = require('path');
const router = express.Router();

const upload = multer({
  dest: path.join(__dirname, '../ocr/temp'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed!'));
  }
});

router.use(authenticateUser);

router.post('/process-invoice', processInvoice);
router.post('/invoice/upload', upload.single('pdf'), handleIOCLUpload);
router.get('/corporation-invoices', handleGetCorporationInvoices);
router.post('/erv/upload', upload.single('pdf'), handleERVUpload);
router.get('/outgoing-ervs', handleGetOutgoingERVs);

module.exports = router; 
const { exec } = require('child_process');
const path = require('path');
const db = require('../db');

// Helper to parse Indian date string to PostgreSQL timestamp format
function parseIndianDatetime(str) {
  if (!str) return null;
  // Fix time part: replace all dots with colons
  if (str.split(' ').length >= 2) {
    const [date, time, ampm] = str.split(' ');
    const fixedTime = time.replace(/\./g, ':');
    str = [date, fixedTime, ampm].filter(Boolean).join(' ');
  }
  const [date, time, ampm] = str.split(' ');
  if (!date || !time) return null;
  const [day, month, year] = date.split('-');
  let [hour, minute, second] = (time || '').split(':');
  if (!second) second = '00';
  if (ampm && ampm.toUpperCase() === 'PM' && hour !== '12') hour = String(Number(hour) + 12);
  if (ampm && ampm.toUpperCase() === 'AM' && hour === '12') hour = '00';
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

exports.processInvoice = (req, res) => {
  const filePath = req.body.path;
  if (!filePath) {
    return res.status(400).json({ error: 'No file path provided' });
  }
  const absPath = path.resolve(filePath);
  const command = `python backend/ocr/extract_invoice_data.py "${absPath}"`;

  exec(command, { timeout: 15000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
    if (err) {
      console.error(stderr || err);
      return res.status(500).json({ error: 'OCR processing failed' });
    }
    try {
      const result = JSON.parse(stdout);
      if (result.error) {
        return res.status(400).json(result);
      }
      res.json(result);
    } catch (e) {
      console.error('Failed to parse OCR output:', stdout);
      res.status(500).json({ error: 'Invalid OCR output format' });
    }
  });
};

exports.handleIOCLUpload = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  const scriptPath = path.resolve(__dirname, '../ocr/ocr_iocl_invoice.py');
  const pdfPath = path.resolve(file.path);

  exec(`python ${scriptPath} ${pdfPath}`, async (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: 'OCR script failed', details: stderr });
    }
    try {
      const parsed = JSON.parse(stdout);
      const { fields, table } = parsed;
      if (!fields || !table || !Array.isArray(table)) {
        return res.status(400).json({ error: 'Invalid OCR output', details: parsed });
      }
      const insertQueries = table.map(item => ({
        text: `
          INSERT INTO iocl_invoice_flat (
            file_name, tax_invoice_no, invoice_no, tt_no, date, eway_bill, po_ref,
            item_no, material_code, material_description, quantity, unit, hsn_code
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7,
            $8, $9, $10, $11, $12, $13
          )`,
        values: [
          file.originalname,
          fields.tax_invoice_no,
          fields.invoice_no,
          fields.tt_no,
          fields.date ? fields.date : null,
          fields.eway_bill,
          fields.po_ref,
          item.item_no,
          item.material_code,
          item.material_description,
          item.quantity,
          item.unit,
          item.hsn_code
        ]
      }));
      for (const query of insertQueries) {
        await db.query(query.text, query.values);
      }
      res.json({ success: true, items_inserted: insertQueries.length });
    } catch (parseError) {
      return res.status(500).json({ error: 'Failed to parse OCR output', details: parseError.message });
    }
  });
};

exports.handleGetCorporationInvoices = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM iocl_invoice_flat ORDER BY created_at DESC');
    res.json({ invoices: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch corporation invoices', details: err.message });
  }
};

exports.handleERVUpload = async (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: 'No PDF file uploaded' });
  }
  const scriptPath = path.resolve(__dirname, '../ocr/ocr_erv_challan.py');
  const pdfPath = path.resolve(file.path);

  exec(`python ${scriptPath} ${pdfPath}`, async (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ error: 'OCR script failed', details: stderr });
    }
    try {
      const parsed = JSON.parse(stdout);
      if (!parsed) {
        return res.status(400).json({ error: 'Invalid OCR output', details: parsed });
      }
      // Insert into erv_challan_flat
      const insertQuery = `
        INSERT INTO erv_challan_flat (
          file_name, distributor_sap_code, sap_plant_code, ac4_no, ac4_date, ac4_receipt_datetime,
          sap_doc_no, delivery_challan_no, delivery_challan_date, truck_no, driver_name,
          eway_bill_amount, remarks, equipment_code, return_description, quantity, created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          $12, $13, $14, $15, $16, NOW()
        )
      `;
      // Parse date fields to PostgreSQL timestamp format
      const ac4_date = parseIndianDatetime(parsed.ac4_date);
      const ac4_receipt_datetime = parseIndianDatetime(parsed.ac4_receipt_datetime);
      const delivery_challan_date = parseIndianDatetime(parsed.delivery_challan_date);
      await db.query(insertQuery, [
        file.originalname,
        parsed.distributor_sap_code,
        parsed.sap_plant_code,
        parsed.ac4_no,
        ac4_date,
        ac4_receipt_datetime,
        parsed.sap_doc_no,
        parsed.delivery_challan_no,
        delivery_challan_date,
        parsed.truck_no,
        parsed.driver_name,
        parsed.eway_bill_amount,
        parsed.remarks,
        parsed.equipment_code,
        parsed.return_description,
        parsed.quantity
      ]);
      res.json({ success: true });
    } catch (parseError) {
      return res.status(500).json({ error: 'Failed to parse OCR output', details: parseError.message });
    }
  });
};

exports.handleGetOutgoingERVs = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM erv_challan_flat ORDER BY created_at DESC');
    res.json({ ervs: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch outgoing ERVs', details: err.message });
  }
}; 
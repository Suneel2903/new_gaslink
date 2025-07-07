const { exec } = require('child_process');
const path = require('path');

// Call the Python OCR script and return the parsed result
async function runPaddleOCR(pdfPath) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../ocr/paddle_ocr_extract.py');
    const command = `python3 "${scriptPath}" "${pdfPath}"`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        return reject(stderr || error.message);
      }
      try {
        const result = JSON.parse(stdout);
        resolve(result);
      } catch (err) {
        reject('Failed to parse OCR output: ' + err.message);
      }
    });
  });
}

module.exports = { runPaddleOCR }; 
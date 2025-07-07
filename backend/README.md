# GasLink Backend Conventions

## Module System
- All backend files use CommonJS (`require`, `module.exports`)
- No `"type": "module"` in any package.json

## Python OCR
- Use Python 3, install dependencies in a venv
- Run OCR script from `/backend/ocr`
- Script accepts a PDF path, returns JSON
- Example usage:
  ```bash
  python extract_invoice_data.py sample_invoice.pdf
  ```

## Node-Python Bridge
- Node calls Python via `child_process.exec`
- Always use timeout and maxBuffer
- Always parse JSON output, handle errors

## File Upload (Future)
- Phase 1: Path-based (dev only)
- Phase 2: Use multer for file upload, then pass path to OCR

## How to Run
1. Activate Python venv, install dependencies
2. Start backend: `npm start`
3. Test OCR: POST to `/api/ocr/process-invoice` with `{ "path": "backend/ocr/sample_invoice.pdf" }`

## Python Script Notes
- Shebang and usage comments included
- Handles missing file and missing argument errors
- Returns JSON output for easy Node parsing

## Security/Production Notes
- Use exec() with timeout and buffer limits
- Always check for valid JSON and handle Python errors/stderr robustly
- For large OCR output, consider using spawn instead of exec 
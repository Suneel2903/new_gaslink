import sys
import json
import os
import re
from utils_ocr import convert_pdf_to_images, load_easyocr_reader, cleanup_temp_images
import tempfile
import easyocr
from pdf2image import convert_from_path

reader = easyocr.Reader(['en'])

def extract_iocl_fields(lines):
    text_blob = "\n".join(lines)
    fields = {}
    # Tax Invoice No (separate from SAP Doc No)
    match = re.search(r"Tax\s*Invoice\s*[-:\s]*([A-Z0-9]+)", text_blob, re.IGNORECASE)
    if match:
        fields["tax_invoice_no"] = match.group(1)
    # SAP Doc Invoice No
    match = re.search(r"SAP\s*Doc\s*no\.?\s*([A-Z0-9]+)", text_blob, re.IGNORECASE)
    if match:
        fields["invoice_no"] = match.group(1)
    # T.T. No
    match = re.search(r"T\.?T\.?\s*No\s*[:\-]*\s*([A-Z0-9]+)", text_blob, re.IGNORECASE)
    if match:
        fields["tt_no"] = match.group(1)
    # E-Way Bill
    match = re.search(r"E[-\s]?WAY\s*Bill\s*[:\-]*\s*([0-9]{10,})", text_blob, re.IGNORECASE)
    if match:
        fields["eway_bill"] = match.group(1)
    # PO Reference
    match = re.search(r"PO\s*ref\s*[:\-]*\s*([A-Z0-9\-]+)", text_blob, re.IGNORECASE)
    if match:
        fields["po_ref"] = match.group(1)
    # Invoice Date
    match = re.search(r"Date\s*[:\-]*\s*([0-9]{1,2}-[A-Za-z]{3}-[0-9]{2,4})", text_blob)
    if match:
        fields["date"] = match.group(1)
    return fields

def extract_material_rows(lines):
    material_rows = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if re.match(r"^\d{1,3}$", line):  # Item No: 10, 101, etc.
            try:
                item_no = line.strip()
                material_code = lines[i+1].strip()
                if not re.match(r"^M\d{4,5}$", material_code):
                    i += 1
                    continue
                material_description = lines[i+2].strip()
                quantity = lines[i+3].strip()
                unit = lines[i+4].strip()
                hsn_code = lines[i+5].strip()
                # Validation
                if not re.match(r"^\d+(\.\d{1,3})?$", quantity):
                    i += 1
                    continue
                if not re.match(r"^\d{6}$", hsn_code):
                    i += 1
                    continue
                material_rows.append({
                    "item_no": item_no,
                    "material_code": material_code,
                    "material_description": material_description,
                    "quantity": quantity,
                    "unit": unit,
                    "hsn_code": hsn_code
                })
                i += 6
            except IndexError:
                i += 1
        else:
            i += 1
    return material_rows

def extract_text_from_pdf(pdf_path):
    images = convert_from_path(pdf_path, dpi=300)
    results = []
    for page_num, image in enumerate(images):
        os.makedirs("backend/ocr/temp", exist_ok=True)
        temp_img_path = os.path.join("backend/ocr/temp", f"page_{page_num}.png")
        image.save(temp_img_path)
        text_lines = reader.readtext(temp_img_path, detail=0)
        results.append({ "page": page_num + 1, "text": text_lines })
        os.unlink(temp_img_path)
    return results

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({ "error": "PDF path not provided" }))
        sys.exit(1)
    pdf_path = sys.argv[1]
    raw_pages = extract_text_from_pdf(pdf_path)
    all_text = []
    for page in raw_pages:
        all_text.extend(page["text"])
    fields = extract_iocl_fields(all_text)
    table = extract_material_rows(all_text)
    output = {
        "fields": fields,
        "table": table
    }
    print(json.dumps(output, indent=2)) 
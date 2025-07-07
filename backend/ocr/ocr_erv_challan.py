import re
import json
import sys
import os
import easyocr
from pdf2image import convert_from_path
import numpy as np

# Accept PDF path as argument
if len(sys.argv) < 2:
    print("Usage: python ocr_erv_challan.py <pdf_path>")
    sys.exit(1)
pdf_path = sys.argv[1]

# Initialize EasyOCR
reader = easyocr.Reader(['en'])

# Convert PDF to images at higher DPI for better OCR accuracy
try:
    images = convert_from_path(pdf_path, dpi=400)
except Exception as e:
    print(json.dumps({"error": f"Could not open PDF: {e}"}))
    sys.exit(1)

# Run OCR on all pages
ocr_lines = []
for img in images:
    img_np = np.array(img)
    results = reader.readtext(img_np, detail=0)
    ocr_lines.extend([str(line) for line in results])

# Join lines for easier regex
all_text = "\n".join(ocr_lines)

def extract(pattern, text, group=1, flags=re.IGNORECASE):
    match = re.search(pattern, text, flags)
    return match.group(group).strip() if match else None

def extract_all(pattern, text, group=1, flags=re.IGNORECASE):
    return [m.group(group).strip() for m in re.finditer(pattern, text, flags)]

output = {
    "distributor_sap_code": extract(r"Distributor Details SAP Code\s*:?\s*(\d+)", all_text),
    "sap_plant_code": extract(r"SAP Plant Code\s*:?\s*(\d+)", all_text),
    "ac4_no": extract(r"AC4\s*:?\s*(\d+)", all_text),
    "sap_doc_no": extract(r"SAP Document No[:\s]*([0-9]+)", all_text),
    "truck_no": extract(r"Truck NO\.?\s*:?\s*([A-Z0-9]+)", all_text),
    "delivery_challan_date": extract(r"Delivery Challan Date\s*:?\s*([0-9\-:\. ]+[APM]{2})", all_text),
    "delivery_challan_no": extract(r"Delivery Challan #\s*:?\s*([\w\-]+)", all_text),
}

# Post-processing function to correct common OCR misreads
# Extend this function for other fields as needed

def correct_ocr_field(field_value, field_name=None):
    if not field_value:
        return field_value
    if field_name == "truck_no":
        # Example: correct TSTZUA5601 to TS12UA5601
        # Replace T with 1 only if it appears after S (for TS1)
        field_value = re.sub(r'TS[T]', 'TS1', field_value)
        # Replace Z with 2 only if it appears after 1 (for 12)
        field_value = re.sub(r'1Z', '12', field_value)
        # Add more corrections as needed
    # Add more field-specific corrections here if needed
    return field_value

# Improved extraction for equipment_code, return_description, and quantity
# Scan for 'Equipment Code' and reconstruct values from following lines
for idx, line in enumerate(ocr_lines):
    if re.match(r"Equipment Code", line, re.IGNORECASE):
        block = ocr_lines[idx:idx+20]
        # Find equipment code block
        eq_desc = None
        eq_empty = None
        eq_code = None
        for bidx, bline in enumerate(block):
            if re.search(r"Kg LPG Cylinder", bline, re.IGNORECASE):
                eq_desc = bline.strip()
            if re.search(r"Empty", bline, re.IGNORECASE):
                eq_empty = bline.strip()
            if re.search(r"\(M\d+", bline):
                eq_code = bline.strip().replace('_', '').replace(' ', '')
        if eq_desc and eq_empty and eq_code:
            equipment_code = f"{eq_desc} - {eq_empty} {eq_code}".replace('  ', ' ')
        else:
            equipment_code = None
        # Find return description block
        ret_desc = None
        for bidx in range(len(block)-1):
            if block[bidx].strip() == 'Good' and block[bidx+1].strip().startswith('On-Hand'):
                ret_desc = 'Good / On-Hand'
                break
        # Find quantity (first number after 'Return Description')
        qty = None
        after_ret = False
        for bline in block:
            if after_ret and re.match(r"^\d{1,5}$", bline.strip()):
                qty = bline.strip()
                break
            if re.match(r"Return Description", bline, re.IGNORECASE):
                after_ret = True
        output["equipment_code"] = equipment_code
        output["return_description"] = ret_desc
        output["quantity"] = qty
        break

# Remove equipment_description from output if present
output.pop("equipment_description", None)

# Ensure these keys are always present in the output
for key in ["equipment_code", "return_description", "quantity"]:
    if key not in output:
        output[key] = None

# Enhanced extraction for truck_no (vehicle number)
# Look for a string starting with two letters, two digits, two letters, and four digits (e.g., TS10UB9177)
vehicle_pattern = re.compile(r'\b([A-Z]{2}\d{2}[A-Z]{2}\d{4})\b')
truck_no = None
for line in ocr_lines:
    match = vehicle_pattern.search(line)
    if match:
        truck_no = match.group(1)
        break
if truck_no:
    output["truck_no"] = truck_no
else:
    # fallback to previous extraction and post-processing
    output["truck_no"] = correct_ocr_field(output.get("truck_no"), field_name="truck_no")

# Enhanced extraction for ac4_no: look for a 10-digit number after a line containing 'AC4'
ac4_no = None
for idx, line in enumerate(ocr_lines):
    if re.search(r"AC4", line, re.IGNORECASE):
        # Look ahead for a 10-digit number
        for lookahead in ocr_lines[idx:idx+5]:
            match = re.search(r"\b(\d{10})\b", lookahead)
            if match:
                ac4_no = match.group(1)
                break
        if ac4_no:
            break
if ac4_no:
    output["ac4_no"] = ac4_no

print(json.dumps(output, indent=2, ensure_ascii=False)) 
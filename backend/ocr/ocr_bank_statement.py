import sys
import json
import os
import re
import numpy as np
import easyocr
from pdf2image import convert_from_path
from collections import defaultdict
from typing import List, Dict, Optional, Tuple

# SBI Statement Column Coordinates (based on provided screenshot)
COLUMN_COORDS = {
    "txn_date": (0, 110),
    "value_date": (110, 210),
    "description": (210, 520),
    "ref_no": (520, 660),
    "debit": (660, 740),
    "credit": (740, 820),
    "balance": (820, 1000)
}

AMOUNT_REGEX = r"\d{1,3}(,\d{3})*(\.\d{2})?"
DATE_REGEX = r"\d{1,2} \w{3} \d{4}"

reader = easyocr.Reader(['en'])

def extract_mode(description: str) -> str:
    desc = description.upper()
    if "NEFT" in desc:
        return "NEFT"
    if "IMPS" in desc:
        return "IMPS"
    if "CHEQUE" in desc:
        return "CHEQUE"
    if "RTGS" in desc:
        return "RTGS"
    return "OTHER"

def extract_customer_name(description: str) -> Optional[str]:
    # Extract after second asterisk, or fallback to first
    parts = description.split('*')
    if len(parts) > 2:
        candidate = parts[2].strip().split()[0]
        if candidate.isalpha():
            return candidate
    elif len(parts) > 1:
        candidate = parts[1].strip().split()[0]
        if candidate.isalpha():
            return candidate
    return None

def format_amount(val: str) -> Optional[str]:
    if not val:
        return None
    val = val.replace(',', '')
    try:
        f = float(val)
        return f"{f:,.2f}"
    except Exception:
        return None

def group_by_y_center(ocr_results, tolerance=15):
    # Group bounding boxes by y_center within tolerance
    rows = defaultdict(list)
    for bbox, text, conf in ocr_results:
        y_center = int((bbox[0][1] + bbox[2][1]) / 2)
        key = round(y_center / tolerance) * tolerance
        rows[key].append((bbox, text, conf))
    return rows

def assign_to_columns(row_words):
    # Assign each word to a column based on x_center
    columns = {col: [] for col in COLUMN_COORDS}
    for bbox, text, conf in row_words:
        x_center = int((bbox[0][0] + bbox[2][0]) / 2)
        for col, (xmin, xmax) in COLUMN_COORDS.items():
            if xmin <= x_center < xmax:
                columns[col].append(text)
                break
    # Join words in each column
    joined = {col: ' '.join(words).strip() for col, words in columns.items()}
    return joined

def parse_row(joined_row):
    txn_date = joined_row["txn_date"]
    value_date = joined_row["value_date"]
    description = joined_row["description"]
    ref_no = joined_row["ref_no"]
    debit = joined_row["debit"]
    credit = joined_row["credit"]
    # Validate date
    if not re.match(DATE_REGEX, txn_date):
        return None
    amount = None
    txn_type = None
    credit_match = re.search(AMOUNT_REGEX, credit)
    debit_match = re.search(AMOUNT_REGEX, debit)
    if credit_match:
        amount = credit_match.group(0)
        txn_type = "credit"
    elif debit_match:
        amount = debit_match.group(0)
        txn_type = "debit"
    else:
        return None
    amount = format_amount(amount)
    mode = extract_mode(description)
    customer_name = extract_customer_name(description)
    return {
        "txn_date": txn_date,
        "value_date": value_date,
        "description": description,
        "ref_no": ref_no,
        "amount": amount,
        "type": txn_type,
        "mode": mode,
        "customer_name": customer_name
    }

def process_bank_statement(pdf_path: str, debug: bool = False) -> Dict:
    images = convert_from_path(pdf_path, dpi=300)
    all_ocr_results = []
    for img in images:
        img_array = np.array(img)
        ocr_result = reader.readtext(img_array, detail=1)
        all_ocr_results.extend(ocr_result)
    # Group by Y-center
    rows = group_by_y_center(all_ocr_results, tolerance=15)
    parsed_rows = []
    for y, row_words in sorted(rows.items()):
        joined = assign_to_columns(row_words)
        print(f"Row Y={y} Columns: {json.dumps(joined, ensure_ascii=False)}")  # Debug print
        parsed = parse_row(joined)
        if parsed:
            parsed_rows.append(parsed)
    # Print first 3 parsed rows for debug
    if debug:
        print(json.dumps(parsed_rows[:3], indent=2))
    return {"table": parsed_rows}

def main():
    if len(sys.argv) != 2:
        print("Usage: python ocr_bank_statement.py <pdf_path>")
        sys.exit(1)
    pdf_path = sys.argv[1]
    if not os.path.exists(pdf_path):
        print(f"Error: PDF file not found: {pdf_path}")
        sys.exit(1)
    result = process_bank_statement(pdf_path, debug=True)
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    main() 
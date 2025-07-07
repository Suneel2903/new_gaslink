import os
import sys
from google.cloud import documentai_v1 as documentai
from google.oauth2 import service_account

# === CONFIGURATION ===
PROJECT_ID = "lpg-cylinder-app"
LOCATION = "us"  # must match processor region
PROCESSOR_ID = "f83d85c403f94ee0"  # BankStatementProcessor
SERVICE_ACCOUNT_JSON = "gcloud/gcloud-service-key.json"
DEFAULT_PDF_PATH = "ocr/1739690677299q4qQwM5bVCj3C6O2.pdf"

# === Accept PDF path as argument ===
if len(sys.argv) < 2:
    print("Usage: python google_bank_statement_ocr.py <pdf_path>")
    sys.exit(1)
PDF_PATH = sys.argv[1]

# === AUTH ===
credentials = service_account.Credentials.from_service_account_file(SERVICE_ACCOUNT_JSON)
client = documentai.DocumentProcessorServiceClient(credentials=credentials)
name = f"projects/{PROJECT_ID}/locations/{LOCATION}/processors/{PROCESSOR_ID}"

# === READ PDF ===
with open(PDF_PATH, "rb") as f:
    pdf_content = f.read()

# === PROCESS ===
raw_document = documentai.RawDocument(content=pdf_content, mime_type="application/pdf")
request = documentai.ProcessRequest(
    name=name,
    raw_document=raw_document,
)

result = client.process_document(request=request)
doc = result.document

# === PRINT RESULTS ===
print(f"\nExtracted Entities for: {PDF_PATH}\n")
if hasattr(doc, 'entities'):
    for entity in doc.entities:
        print(f"{entity.type_}: {entity.mention_text}")
else:
    print("No entities found in the document.") 
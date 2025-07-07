import easyocr
from pdf2image import convert_from_path
import os
import tempfile

def convert_pdf_to_images(pdf_path, dpi=300):
    return convert_from_path(pdf_path, dpi=dpi)

def load_easyocr_reader(lang_list=['en']):
    return easyocr.Reader(lang_list)

def cleanup_temp_images(temp_dir):
    for fname in os.listdir(temp_dir):
        if fname.endswith('.png'):
            try:
                os.remove(os.path.join(temp_dir, fname))
            except Exception:
                pass 
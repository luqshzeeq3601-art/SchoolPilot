"""Session-scoped chat attachments (Option A: OCR + text LLM).

Teachers can attach one PDF or image per query. Text is extracted
ephemerally and injected as extra RAG context — never written to the
global Document/DocumentChunk tables.
"""
import io
import logging
import os
import re

logger = logging.getLogger(__name__)

MAX_CHAT_FILE_BYTES = 10 * 1024 * 1024  # 10 MB session limit
MAX_ATTACHMENT_CHARS = 12000  # truncate to fit qwen2.5:7b num_ctx=4096
MAX_PDF_OCR_PAGES = 3  # limit OCR cost on scanned PDFs

ALLOWED_EXTS = {".pdf", ".png", ".jpg", ".jpeg"}


def clean_chat_filename(raw: str) -> str:
    name = os.path.basename(raw or "attachment")
    name = re.sub(r"[^\w\s\.-]", "_", name).strip()
    return name or "attachment"


def validate_chat_file(filename: str, contents: bytes) -> str:
    """Validate extension + magic bytes. Returns cleaned filename or raises ValueError."""
    clean = clean_chat_filename(filename)
    ext = os.path.splitext(clean.lower())[1]
    if ext not in ALLOWED_EXTS:
        raise ValueError("Unsupported file. Please attach PDF, PNG, or JPG (max 10MB).")
    if not contents:
        raise ValueError("Attached file is empty.")
    if len(contents) > MAX_CHAT_FILE_BYTES:
        raise ValueError("Attached file exceeds 10MB session limit.")
    if ext == ".pdf" and not contents.startswith(b"%PDF-"):
        raise ValueError("Invalid PDF file.")
    if ext == ".png" and not contents.startswith(b"\x89PNG"):
        raise ValueError("Invalid PNG file.")
    if ext in (".jpg", ".jpeg") and not contents.startswith(b"\xff\xd8\xff"):
        raise ValueError("Invalid JPG file.")
    return clean


def ocr_image_bytes(image_bytes: bytes) -> str:
    """OCR a PNG/JPG buffer with Pillow + tesseract. Returns stripped text (may be '')."""
    try:
        from PIL import Image
        import pytesseract

        # Bound decompression-bomb risk before decode (DoS via huge dimensions).
        Image.MAX_IMAGE_PIXELS = min(getattr(Image, "MAX_IMAGE_PIXELS", 89478485) or 89478485, 50_000_000)
    except ImportError:
        logger.warning("Pillow/pytesseract not installed — image OCR skipped.")
        return ""
    try:
        from PIL.Image import DecompressionBombError

        try:
            img = Image.open(io.BytesIO(image_bytes))
            # Trigger header decode under the pixel limit.
            img.load()
        except DecompressionBombError:
            logger.warning("Image rejected: exceeds pixel safety limit.")
            return ""
        # Normalise for OCR: grayscale + upscale tiny images
        if img.mode not in ("L", "RGB"):
            img = img.convert("RGB")
        gray = img.convert("L")
        w, h = gray.size
        if max(w, h) < 1200:
            scale = 1200 / max(w, h)
            gray = gray.resize((int(w * scale), int(h * scale)))
        text = pytesseract.image_to_string(gray, lang="eng")
        return (text or "").strip()
    except Exception as e:
        logger.warning("Image OCR failed: %s", e)
        return ""


def extract_pdf_session_text(file_bytes: bytes) -> str:
    """Extract text from PDF bytes; OCR first pages if scanned (no embedded text)."""
    from app.documents.chunker import extract_text_from_pdf

    try:
        pages = extract_text_from_pdf(file_bytes)  # List[(page_num, text)]
    except Exception as e:
        logger.warning("PDF text extract failed: %s", e)
        pages = []
    joined = "\n\n".join(t for _, t in pages if t and t.strip()).strip()
    if len(joined) >= 50:
        return joined
    # Scanned PDF fallback: render pages to PNG and OCR
    try:
        import fitz

        doc = fitz.open(stream=file_bytes, filetype="pdf")
        ocr_parts = []
        for i in range(min(len(doc), MAX_PDF_OCR_PAGES)):
            pix = doc[i].get_pixmap(dpi=200)
            ocr_parts.append(ocr_image_bytes(pix.tobytes("png")))
        doc.close()
        return "\n\n".join(p for p in ocr_parts if p.strip()).strip()
    except Exception as e:
        logger.warning("Scanned-PDF OCR fallback failed: %s", e)
        return joined


def extract_attachment_text(clean_filename: str, contents: bytes) -> str:
    ext = os.path.splitext(clean_filename.lower())[1]
    if ext == ".pdf":
        return extract_pdf_session_text(contents)
    return ocr_image_bytes(contents)


def build_attachment_context(filename: str, raw_text: str) -> str:
    text = (raw_text or "").strip()
    if not text:
        return ""
    if len(text) > MAX_ATTACHMENT_CHARS:
        text = text[:MAX_ATTACHMENT_CHARS] + "\n…[truncated to fit context window]"
    return f"[Uploaded file: {filename} — session-only, not in permanent KB]\n{text}"

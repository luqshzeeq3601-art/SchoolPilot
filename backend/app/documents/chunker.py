import re
from typing import List, Dict, Any, Tuple
import fitz  # PyMuPDF
from docx import Document as DocxDocument


def extract_text_from_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
    """Extract (page_number, text) tuples from PDF bytes."""
    pages = []
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    for page_idx in range(len(doc)):
        page = doc[page_idx]
        text = page.get_text()
        if text.strip():
            pages.append((page_idx + 1, text))
    doc.close()
    return pages


def extract_text_from_docx(file_bytes: bytes) -> List[Tuple[int, str]]:
    """Extract text from DOCX bytes."""
    import io
    doc = DocxDocument(io.BytesIO(file_bytes))
    full_text = []
    for para in doc.paragraphs:
        if para.text.strip():
            full_text.append(para.text)
    combined = "\n\n".join(full_text)
    return [(1, combined)] if combined else []


def extract_text_from_markdown(content: str) -> List[Tuple[int, str]]:
    """Return markdown as page 1 content."""
    return [(1, content)]


def split_text_into_chunks(
    pages: List[Tuple[int, str]],
    document_name: str,
    max_chunk_chars: int = 1800,
    overlap_chars: int = 200,
) -> List[Dict[str, Any]]:
    """
    Split extracted pages into structured chunks with section hierarchy
    and contextual prefix enrichment.
    """
    chunks = []
    chunk_index = 0

    current_section = "General"
    heading_pattern = re.compile(r"^(?:#+\s*|\b(?:\d+\.)+\s+)([A-Z0-9].*)$", re.MULTILINE)

    for page_num, text in pages:
        # Check for headings to update section title
        lines = text.split("\n")
        section_blocks = []
        current_block_lines = []

        for line in lines:
            match = heading_pattern.match(line.strip())
            if match:
                if current_block_lines:
                    section_blocks.append((current_section, "\n".join(current_block_lines)))
                    current_block_lines = []
                current_section = match.group(1).strip()
            current_block_lines.append(line)

        if current_block_lines:
            section_blocks.append((current_section, "\n".join(current_block_lines)))

        for section_title, block_text in section_blocks:
            clean_block = block_text.strip()
            if not clean_block:
                continue

            # If block fits in single chunk
            if len(clean_block) <= max_chunk_chars:
                enriched_text = f"[Document: {document_name} > Section: {section_title}]\n{clean_block}"
                chunks.append({
                    "chunk_index": chunk_index,
                    "page_number": page_num,
                    "section_title": section_title,
                    "content": enriched_text,
                    "raw_text": clean_block,
                })
                chunk_index += 1
            else:
                # Split large blocks with overlap
                start = 0
                while start < len(clean_block):
                    end = start + max_chunk_chars
                    slice_text = clean_block[start:end].strip()
                    if slice_text:
                        enriched_text = f"[Document: {document_name} > Section: {section_title}]\n{slice_text}"
                        chunks.append({
                            "chunk_index": chunk_index,
                            "page_number": page_num,
                            "section_title": section_title,
                            "content": enriched_text,
                            "raw_text": slice_text,
                        })
                        chunk_index += 1
                    start += (max_chunk_chars - overlap_chars)

    return chunks

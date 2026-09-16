from app.documents.chunker import extract_text_from_markdown, split_text_into_chunks


def test_markdown_chunking_and_context_enrichment():
    markdown_sample = """# Section 1. Attendance
Staff must arrive before 07:20 AM every weekday.

# Section 2. Emergency Leave
Emergency leave requires notification before 06:45 AM.
A covering teacher must be nominated for relief classes.
"""
    pages = extract_text_from_markdown(markdown_sample)
    assert len(pages) == 1

    chunks = split_text_into_chunks(pages, "Staff Handbook.md", max_chunk_chars=500)
    assert len(chunks) >= 2

    # Check contextual prefix enrichment
    first_chunk = chunks[0]
    assert "[Document: Staff Handbook.md > Section:" in first_chunk["content"]
    assert "Section 1. Attendance" in first_chunk["section_title"]

import asyncio
import hashlib
import os
from sqlalchemy import select
from app.database import AsyncSessionLocal, engine, Base
from app.users.models import User, UserRole
from app.documents.models import Document, DocumentChunk
from app.documents.chunker import extract_text_from_markdown, split_text_into_chunks
from app.documents.embedder import embed_batch_documents


async def seed_documents():
    """Ingest synthetic school documents (staff handbook and leave SOP) into pgvector."""
    async with AsyncSessionLocal() as session:
        # Find or create admin user
        stmt = select(User).where(User.role == UserRole.ADMIN).limit(1)
        admin = (await session.execute(stmt)).scalar_one_or_none()
        if not admin:
            from app.main import seed_initial_users
            print("No admin user found. Running seed_initial_users()...")
            await seed_initial_users()
            admin = (await session.execute(stmt)).scalar_one_or_none()

        if not admin:
            print("Unable to seed or locate admin user.")
            return

        doc_files = [
            ("Sri Cempaka Staff Operational Handbook.md", "staff-handbook.md"),
            ("Leave Policy & Workflow Routing SOP.md", "leave-policy-sop.md"),
        ]

        candidate_dirs = [
            "/app/data",
            os.path.join(os.path.dirname(os.path.dirname(__file__)), "data"),
            os.path.abspath("data"),
            os.path.join(os.path.dirname(__file__), "..", "data"),
        ]

        data_dir = None
        for d in candidate_dirs:
            if os.path.exists(d) and os.path.exists(os.path.join(d, "staff-handbook.md")):
                data_dir = d
                break

        if not data_dir:
            print(f"Could not find data directory in candidates: {candidate_dirs}")
            return

        for display_name, filename in doc_files:
            file_path = os.path.join(data_dir, filename)
            if not os.path.exists(file_path):
                print(f"File not found: {file_path}")
                continue

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            file_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()

            # Check if already seeded
            stmt = select(Document).where(Document.file_hash == file_hash)
            existing = (await session.execute(stmt)).scalar_one_or_none()
            if existing:
                print(f"Document already ingested: {display_name}")
                continue

            print(f"Ingesting: {display_name}...")
            pages = extract_text_from_markdown(content)
            chunks_data = split_text_into_chunks(pages, display_name)

            doc_rec = Document(
                filename=display_name,
                file_hash=file_hash,
                file_type="markdown",
                uploaded_by=admin.id,
                metadata_={"total_sections": len(chunks_data), "source": "synthetic_seed"},
            )
            session.add(doc_rec)
            await session.flush()

            # Batch embed chunks
            chunk_contents = [c["content"] for c in chunks_data]
            batch_size = 10
            all_embeddings = []
            for i in range(0, len(chunk_contents), batch_size):
                batch = chunk_contents[i : i + batch_size]
                emb_batch = await embed_batch_documents(batch)
                all_embeddings.extend(emb_batch)

            for c_info, emb in zip(chunks_data, all_embeddings):
                chunk_rec = DocumentChunk(
                    document_id=doc_rec.id,
                    chunk_index=c_info["chunk_index"],
                    page_number=c_info["page_number"],
                    section_title=c_info["section_title"],
                    content=c_info["content"],
                    embedding=emb,
                    metadata_={"raw_length": len(c_info["raw_text"])},
                )
                session.add(chunk_rec)

            await session.commit()
            print(f"Ingested {display_name} ({len(chunks_data)} chunks embedded in pgvector).")


if __name__ == "__main__":
    asyncio.run(seed_documents())

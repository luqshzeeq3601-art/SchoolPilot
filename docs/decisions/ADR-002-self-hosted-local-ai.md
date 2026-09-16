# ADR-002: Local Self-Hosted AI Infrastructure (Ollama + PostgreSQL pgvector)

## Status
Accepted

## Date
2026-09-16

## Context
Schools and educational institutions handle sensitive internal data including staff medical leave records, confidential HR policies, examination rules, and student welfare protocols. Transmitting this data to third-party commercial LLM APIs introduces recurring subscription costs, vendor lock-in, and data privacy compliance concerns.

## Decision
Deploy a **100% self-hosted local AI stack**:
1. **Embedding Model**: `nomic-embed-text` (768 embedding dimensions, 8192 token context window) executing locally via Ollama.
2. **Vector Index**: PostgreSQL 16 with the `pgvector` extension, indexed using **HNSW (Hierarchical Navigable Small World)** with cosine distance metric (`vector_cosine_ops`, `m=16`, `ef_construction=64`).
3. **Inference LLM**: `qwen2.5:7b` (or `llama3.1:8b`) running on the local host with GPU acceleration via Ollama.
4. **Structured Output**: Ollama JSON format enforcement paired with Pydantic v2 schemas to ensure strictly valid JSON responses containing grounded citations and extracted actionable fields.

## Consequences
### Positive
- **Zero API Costs (RM0)**: No recurring per-token fees or cloud provider subscriptions.
- **Data Sovereignty & Privacy**: All policy documents, staff questions, and leave reasons remain strictly on-premises on institutional hardware.
- **Predictable Sub-Second Embeddings**: Document chunk embeddings and search queries execute with low latency without external internet dependencies.

### Trade-Offs & Mitigations
- Host hardware must meet minimum system requirements (e.g., 16 GB RAM and modern multi-core CPU or 6GB+ VRAM NVIDIA GPU).
- Fallback embeddings and smaller model quantizations (e.g., `qwen2.5:0.5b` or `smollm2:135m`) are supported for resource-constrained test environments.

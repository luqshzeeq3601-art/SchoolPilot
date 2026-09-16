# Contributing to SchoolPilot

Thank you for your interest in contributing to **SchoolPilot**!

---

## 1. Code of Conduct

We are committed to providing a friendly, safe, and welcoming environment for all contributors. Please treat fellow maintainers and contributors with respect and professionalism.

---

## 2. Development Setup

### Prerequisites
- Python 3.10+ (Python 3.12 recommended)
- Node.js 18+ (Node 20/22 recommended) and npm
- Docker Desktop with Compose
- [Ollama](https://ollama.com) running locally with `qwen2.5:7b` and `nomic-embed-text`

### Local Setup
1. **Clone repository**:
   ```bash
   git clone https://github.com/<org>/schoolpilot.git
   cd schoolpilot
   ```
2. **Configure environment**:
   ```bash
   cp .env.example .env
   ```
3. **Run services**:
   - On Windows: Run `run.bat`
   - With Docker: Run `docker compose up -d`

---

## 3. Pull Request Guidelines

1. **Branch Naming**: Use descriptive branch names (`feat/feature-name`, `fix/bug-description`, `docs/update-guide`).
2. **Atomic Commits**: Keep changes focused with conventional commit messages (`feat: ...`, `fix: ...`, `test: ...`, `docs: ...`).
3. **Quality Gates**:
   - Run backend tests:
     ```bash
     $env:PYTHONPATH="backend"; pytest backend/tests -v
     ```
   - Run frontend build & type check:
     ```bash
     cd frontend && npm run build
     ```
4. **Preserve RM0 Cost & Privacy**: Do not add dependencies on paid cloud AI APIs. Core features must run locally.

---

## 4. Submitting Changes

1. Fork the repository and create your branch from `main`.
2. Ensure all tests and builds pass.
3. Open a Pull Request with a clear description of the problem solved and test verification results.

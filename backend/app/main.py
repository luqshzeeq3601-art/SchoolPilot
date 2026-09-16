import json
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy import select, text
from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.users.models import User, UserRole
from app.auth.jwt import get_password_hash
from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.documents.router import router as documents_router
from app.chat.router import router as chat_router
from app.leave.router import router as leave_router
from app.audit.router import router as audit_router
from app.system.router import router as system_router


async def seed_initial_users():
    """Seed default staff accounts from seed_users.json if the users table is empty."""
    async with AsyncSessionLocal() as session:
        stmt = select(User).limit(1)
        existing = (await session.execute(stmt)).scalar_one_or_none()
        if existing is not None:
            return

        seed_file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "..", "data", "seed_users.json")
        # In Docker container, /app/data/seed_users.json or fallback
        if not os.path.exists(seed_file_path):
            seed_file_path = "/app/data/seed_users.json"
        if not os.path.exists(seed_file_path):
            seed_file_path = os.path.abspath(os.path.join(os.getcwd(), "data", "seed_users.json"))

        if os.path.exists(seed_file_path):
            with open(seed_file_path, "r", encoding="utf-8") as f:
                users_data = json.load(f)

            for u in users_data:
                user = User(
                    email=u["email"].lower().strip(),
                    hashed_password=get_password_hash(u["password"]),
                    full_name=u["full_name"],
                    role=UserRole(u["role"]),
                    department=u["department"],
                    is_active=u["is_active"],
                )
                session.add(user)
            await session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Ensure pgvector extension and create schema tables
    async with engine.begin() as conn:
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed default user accounts
    try:
        await seed_initial_users()
    except Exception as e:
        print(f"Notice: User seeding skipped or deferred: {e}")

    yield
    # Shutdown: dispose DB connection pool
    await engine.dispose()


app = FastAPI(
    title="SchoolPilot API",
    description="AI-Powered School Operations & Automation Platform (FastAPI + pgvector + n8n)",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS for Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-N8N-API-KEY", "X-API-Key", "X-User-Email"],
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Minimal safe headers; no new deps, no break for local http."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
        return response


app.add_middleware(SecurityHeadersMiddleware)

# Register API routes
prefix = settings.API_V1_PREFIX
app.include_router(auth_router, prefix=prefix)
app.include_router(users_router, prefix=prefix)
app.include_router(documents_router, prefix=prefix)
app.include_router(chat_router, prefix=prefix)
app.include_router(leave_router, prefix=prefix)
app.include_router(audit_router, prefix=prefix)
app.include_router(system_router, prefix=prefix)


@app.get("/health", tags=["Health"])
async def health_check():
    return {
        "status": "healthy",
        "service": "SchoolPilot Backend",
        "llm_model": settings.LLM_MODEL,
        "embedding_model": settings.EMBEDDING_MODEL,
    }

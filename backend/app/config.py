import logging
import warnings
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import field_validator
from typing import List

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    PROJECT_NAME: str = "SchoolPilot"
    API_V1_PREFIX: str = "/api/v1"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/schoolops"
    
    # Local AI / Ollama
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    EMBEDDING_MODEL: str = "nomic-embed-text"
    LLM_MODEL: str = "qwen2.5:7b"
    
    # n8n Automation Engine
    N8N_WEBHOOK_URL: str = "http://localhost:5678/webhook/"
    N8N_API_KEY: str = "schoolops_n8n_secret_key_2026"
    
    # JWT Security
    JWT_SECRET: str = "schoolops_jwt_secret_key_production_32chars_minimum"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # File Storage
    UPLOAD_DIR: str = "/app/uploads"
    
    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000"
    
    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @field_validator("N8N_API_KEY")
    @classmethod
    def validate_n8n_key(cls, v: str) -> str:
        if len(v) < 16:
            raise ValueError("N8N_API_KEY must be at least 16 characters long.")
        if v in ("schoolops_n8n_secret_key_2026", "schoolpilot_n8n_secret_key_2026"):
            warnings.warn(
                "SECURITY WARNING: Using default hardcoded N8N_API_KEY. Override via .env in production.",
                UserWarning,
                stacklevel=2,
            )
        return v

    @field_validator("JWT_SECRET")
    @classmethod
    def validate_jwt_secret(cls, v: str) -> str:
        if len(v) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters long for cryptographic security.")
        if v in ("schoolpilot_jwt_secret_key_production_32chars_minimum", "schoolops_jwt_secret_key_production_32chars_minimum"):
            warnings.warn(
                "SECURITY WARNING: Using default hardcoded JWT_SECRET. Override via .env in production.",
                UserWarning,
                stacklevel=2,
            )
        return v

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

from typing import Optional
import uuid
from pydantic import BaseModel, EmailStr
from app.users.models import UserRole


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: uuid.UUID
    email: str
    full_name: str
    role: UserRole
    department: str


class TokenPayload(BaseModel):
    sub: str
    user_id: str
    role: str
    department: str
    exp: Optional[int] = None

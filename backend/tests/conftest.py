import pytest
import uuid
from app.auth.jwt import create_access_token, get_password_hash, verify_password
from app.users.models import UserRole


@pytest.fixture
def test_password():
    return "TestSecret123!"


@pytest.fixture
def hashed_password(test_password):
    return get_password_hash(test_password)


@pytest.fixture
def sample_user_payload():
    return {
        "sub": "teacher.test@cempaka.edu.my",
        "user_id": str(uuid.uuid4()),
        "role": UserRole.TEACHER.value,
        "department": "Science",
    }

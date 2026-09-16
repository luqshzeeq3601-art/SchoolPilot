import pytest
from app.auth.jwt import verify_password, create_access_token, decode_access_token


def test_password_hashing(test_password, hashed_password):
    assert verify_password(test_password, hashed_password) is True
    assert verify_password("WrongPassword!", hashed_password) is False


def test_jwt_token_generation_and_decoding(sample_user_payload):
    token = create_access_token(sample_user_payload)
    assert isinstance(token, str)
    assert len(token) > 20

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == sample_user_payload["sub"]
    assert decoded["user_id"] == sample_user_payload["user_id"]
    assert decoded["role"] == sample_user_payload["role"]
    assert decoded["department"] == sample_user_payload["department"]


def test_invalid_jwt_token():
    assert decode_access_token("invalid.token.string") is None

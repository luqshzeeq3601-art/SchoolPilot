import os
import pytest
import pytest_asyncio
from datetime import date
import httpx
from app.config import settings
from app.auth.jwt import create_access_token


BASE_URL = os.getenv("BACKEND_TEST_URL", "http://localhost:8005/api/v1")


@pytest.fixture(autouse=True, scope="module")
def check_live_server():
    """Skip live integration tests if local server instance is not running."""
    try:
        health_url = BASE_URL.replace("/api/v1", "/health")
        with httpx.Client(timeout=2.0) as client:
            resp = client.get(health_url)
            if resp.status_code != 200:
                pytest.skip(f"Live backend service not responding on {health_url}. Skipping live integration tests.")
    except Exception:
        pytest.skip(f"Live backend service not running on {BASE_URL}. Skipping live integration tests.")


@pytest.mark.asyncio
async def test_01_authentication_roles():
    """Verify login and JWT token generation for Teacher, HoD, and Admin."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=10.0) as client:
        # 1. Teacher login
        teacher_res = await client.post(
            "/auth/login",
            json={"email": "teacher.azman@cempaka.edu.my", "password": "Password123!"},
        )
        assert teacher_res.status_code == 200
        teacher_data = teacher_res.json()
        assert teacher_data["role"] == "teacher"
        assert teacher_data["department"] == "Science & Mathematics"
        assert "access_token" in teacher_data

        # 2. HoD login
        hod_res = await client.post(
            "/auth/login",
            json={"email": "hod.science@cempaka.edu.my", "password": "Password123!"},
        )
        assert hod_res.status_code == 200
        hod_data = hod_res.json()
        assert hod_data["role"] == "hod"

        # 3. Admin login
        admin_res = await client.post(
            "/auth/login",
            json={"email": "admin@cempaka.edu.my", "password": "Password123!"},
        )
        assert admin_res.status_code == 200
        admin_data = admin_res.json()
        assert admin_data["role"] == "admin"


@pytest.mark.asyncio
async def test_02_document_rag_retrieval():
    """Verify that seeded documents exist and pgvector retrieves cited emergency leave policy."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=90.0) as client:
        # Get admin token to check documents
        login_res = await client.post(
            "/auth/login",
            json={"email": "admin@cempaka.edu.my", "password": "Password123!"},
        )
        token = login_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check documents endpoint
        docs_res = await client.get("/documents/", headers=headers)
        assert docs_res.status_code == 200
        docs = docs_res.json()
        assert len(docs) >= 2
        total_chunks = sum(d["chunk_count"] for d in docs)
        assert total_chunks >= 30  # Handbook (28) + SOP (12) = 40 chunks

        # Query Policy RAG endpoint as teacher (direct API fallback mode for fast deterministic check)
        teacher_login = await client.post(
            "/auth/login",
            json={"email": "teacher.azman@cempaka.edu.my", "password": "Password123!"},
        )
        t_token = teacher_login.json()["access_token"]
        t_headers = {"Authorization": f"Bearer {t_token}"}

        chat_res = await client.post(
            "/chat/query",
            json={
                "query": "What is the procedure if I need emergency leave tomorrow?",
                "use_n8n": False,
            },
            headers=t_headers,
        )
        assert chat_res.status_code == 200
        chat_data = chat_res.json()
        assert "answer" in chat_data
        assert chat_data["confidence"] in ["high", "medium", "low"]
        assert len(chat_data["citations"]) > 0
        # Check first citation
        first_cite = chat_data["citations"][0]
        assert "document_name" in first_cite
        assert "page_number" in first_cite
        assert "exact_quote" in first_cite


@pytest.mark.asyncio
async def test_03_intent_detection_actionable_leave():
    """Verify that actionable leave queries trigger intent='leave_request' and field extraction."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=90.0) as client:
        teacher_login = await client.post(
            "/auth/login",
            json={"email": "teacher.azman@cempaka.edu.my", "password": "Password123!"},
        )
        token = teacher_login.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        res = await client.post(
            "/chat/query",
            json={
                "query": "I need emergency leave tomorrow due to severe family illness, Mr. Lee will cover",
                "use_n8n": False,
            },
            headers=headers,
        )
        assert res.status_code == 200
        data = res.json()
        assert data["intent"] == "leave_request"
        assert data["detected_leave_fields"] is not None
        fields = data["detected_leave_fields"]
        assert fields["leave_type"] is not None


@pytest.mark.asyncio
async def test_04_full_leave_request_approval_audit_flow():
    """
    End-to-End Workflow:
    Teacher submits leave -> HoD inspects & approves -> Admin verifies in Audit Log.
    """
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=15.0) as client:
        # 1. Teacher login
        teacher_login = await client.post(
            "/auth/login",
            json={"email": "teacher.azman@cempaka.edu.my", "password": "Password123!"},
        )
        t_token = teacher_login.json()["access_token"]
        t_headers = {"Authorization": f"Bearer {t_token}"}

        # 2. Teacher submits emergency leave application
        today_str = date.today().isoformat()
        leave_payload = {
            "leave_type": "emergency",
            "start_date": today_str,
            "end_date": today_str,
            "reason": "Sudden transit delay due to broken down vehicle; relief task sent.",
            "covering_teacher": "Mr. Lee Wei Hong",
        }
        submit_res = await client.post("/leave/request", json=leave_payload, headers=t_headers)
        assert submit_res.status_code == 201
        leave_data = submit_res.json()
        leave_id = leave_data["id"]
        assert leave_data["status"] == "pending"
        assert leave_data["covering_teacher"] == "Mr. Lee Wei Hong"

        # 3. Science HoD logs in
        hod_login = await client.post(
            "/auth/login",
            json={"email": "hod.science@cempaka.edu.my", "password": "Password123!"},
        )
        hod_token = hod_login.json()["access_token"]
        hod_headers = {"Authorization": f"Bearer {hod_token}"}

        # 4. HoD lists pending requests (should see Cikgu Azman's request)
        list_res = await client.get("/leave/?status_filter=pending", headers=hod_headers)
        assert list_res.status_code == 200
        pending_list = list_res.json()
        matching = [l for l in pending_list if l["id"] == leave_id]
        assert len(matching) == 1
        assert matching[0]["teacher_name"] == "Cikgu Azman bin Razali"

        # 5. HoD approves request with remarks
        approve_res = await client.patch(
            f"/leave/{leave_id}/approve",
            json={"notes": "Approved. Relief work confirmed with Mr. Lee."},
            headers=hod_headers,
        )
        assert approve_res.status_code == 200
        approved_data = approve_res.json()
        assert approved_data["status"] == "approved"
        assert approved_data["reviewer_name"] == "Dr. Ramesh Krishnan"
        assert approved_data["review_notes"] == "Approved. Relief work confirmed with Mr. Lee."

        # 6. Admin logs in and inspects Audit Trail
        admin_login = await client.post(
            "/auth/login",
            json={"email": "admin@cempaka.edu.my", "password": "Password123!"},
        )
        admin_token = admin_login.json()["access_token"]
        admin_headers = {"Authorization": f"Bearer {admin_token}"}

        audit_res = await client.get("/audit/logs?limit=20", headers=admin_headers)
        assert audit_res.status_code == 200
        audit_logs = audit_res.json()
        assert len(audit_logs) > 0

        # Check for leave_submitted and leave_approved actions in audit log
        actions = [log["action"] for log in audit_logs]
        assert "leave_submitted" in actions
        assert "leave_approved" in actions

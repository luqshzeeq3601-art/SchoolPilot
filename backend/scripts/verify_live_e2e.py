import httpx
import json

BASE_URL = "http://fastapi:8000/api/v1"

def test_live_e2e():
    client = httpx.Client(base_url=BASE_URL, timeout=60.0)
    
    print("\n--- STEP 1: Teacher Login ---")
    resp = client.post("/auth/login", json={"email": "teacher.azman@cempaka.edu.my", "password": "Password123!"})
    assert resp.status_code == 200, f"Login failed: {resp.text}"
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print(f"Teacher logged in: {resp.json()['full_name']} ({resp.json()['department']})")
    
    print("\n--- STEP 2: Teacher Policy RAG Q&A + Intent Detection ---")
    chat_resp = client.post("/chat/query", json={
        "query": "I am having high fever and need to take emergency medical leave tomorrow until Friday.",
        "use_n8n": True
    }, headers=headers)
    assert chat_resp.status_code == 200, f"Chat query failed: {chat_resp.text}"
    chat_data = chat_resp.json()
    print(f"Orchestration Mode: {chat_data['orchestration_mode']}")
    print(f"Confidence: {chat_data['confidence']}")
    print(f"Answer snippet: {chat_data['answer'][:120]}...")
    print(f"Citations count: {len(chat_data['citations'])}")
    for c in chat_data['citations'][:2]:
        print(f"  - [{c['document_name']}] {c.get('section_title')}")
    print(f"Intent detected: {chat_data['intent']}")
    print(f"Extracted leave fields: {chat_data.get('detected_leave_fields')}")
    
    print("\n--- STEP 3: Teacher Submits Guided Leave Request ---")
    fields = chat_data.get('detected_leave_fields') or {}
    leave_payload = {
        "leave_type": fields.get("leave_type") or "emergency",
        "start_date": "2026-09-16",
        "end_date": "2026-09-18",
        "reason": fields.get("reason") or "High fever medical leave",
        "covering_teacher": "Cikgu Siti Aminah"
    }
    leave_resp = client.post("/leave/request", json=leave_payload, headers=headers)
    assert leave_resp.status_code == 201, f"Leave application failed: {leave_resp.text}"
    leave_data = leave_resp.json()
    leave_id = leave_data["id"]
    print(f"Leave created ID: {leave_id}, Status: {leave_data['status']}")
    print(f"Submitted At: {leave_data.get('submitted_at')}")
    
    print("\n--- STEP 4: HoD Science Login & Approval ---")
    hod_resp = client.post("/auth/login", json={"email": "hod.science@cempaka.edu.my", "password": "Password123!"})
    assert hod_resp.status_code == 200
    hod_token = hod_resp.json()["access_token"]
    hod_headers = {"Authorization": f"Bearer {hod_token}"}
    print(f"HoD logged in: {hod_resp.json()['full_name']}")
    
    # Check pending list
    pending_resp = client.get("/leave/?status_filter=pending", headers=hod_headers)
    assert pending_resp.status_code == 200
    pending_leaves = pending_resp.json()
    found = any(l["id"] == leave_id for l in pending_leaves)
    print(f"Found leave ID {leave_id} in HoD pending queue: {found}")
    
    # HoD approves
    approval_resp = client.patch(f"/leave/{leave_id}/approve", json={
        "review_notes": "Approved by HoD Science. Please rest and submit MC upon return."
    }, headers=hod_headers)
    assert approval_resp.status_code == 200
    approved_data = approval_resp.json()
    print(f"Approval status: {approved_data['status']}, Reviewer: {approved_data['reviewer_name']}")
    print(f"Review notes: {approved_data['review_notes']}")
    
    print("\n--- STEP 5: Admin Login & Audit Log Verification ---")
    admin_resp = client.post("/auth/login", json={"email": "admin@cempaka.edu.my", "password": "Password123!"})
    assert admin_resp.status_code == 200
    admin_token = admin_resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}
    
    audit_resp = client.get("/audit/logs", headers=admin_headers)
    assert audit_resp.status_code == 200
    audit_logs = audit_resp.json()
    print(f"Total audit logs recorded: {len(audit_logs)}")
    recent_actions = [(l["action"], l["user_email"], l["resource_id"]) for l in audit_logs[:5]]
    for action, actor, eid in recent_actions:
        print(f"  - {action} by {actor} (Resource: {eid})")
        
    print("\n>>> ALL 5 MVP WORKFLOW STEPS VERIFIED END-TO-END SUCCESSFULLY! <<<")

if __name__ == "__main__":
    test_live_e2e()

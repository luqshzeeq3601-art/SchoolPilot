import asyncio
import asyncpg
import json
from pathlib import Path

async def sync_workflow_json():
    conn = await asyncpg.connect("postgresql://postgres:postgres@postgres:5432/n8n")
    
    leave_nodes = [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "leave-approval",
                "responseMode": "responseNode",
                "options": {}
            },
            "id": "1",
            "name": "Webhook Trigger",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [220, 300],
            "webhookId": "leave-approval-hook-id"
        },
        {
            "parameters": {
                "jsCode": """// Extract and validate incoming payload
const payload = $input.item.json.body || $input.item.json;

if (!payload.leave_id || !payload.teacher_email) {
  throw new Error('Missing essential leave parameters.');
}

// Determine department approver
let approverEmail = 'admin@cempaka.edu.my';
let approverRole = 'School Administrator';

if (payload.department === 'Science & Mathematics') {
  approverEmail = 'hod.science@cempaka.edu.my';
  approverRole = 'Head of Department (Science & Math)';
} else if (payload.department === 'Humanities & Languages') {
  approverEmail = 'hod.humanities@cempaka.edu.my';
  approverRole = 'Head of Department (Humanities)';
}

return {
  json: {
    leave_id: payload.leave_id,
    teacher_name: payload.teacher_name,
    teacher_email: payload.teacher_email,
    department: payload.department,
    leave_type: payload.leave_type,
    start_date: payload.start_date,
    end_date: payload.end_date,
    reason: payload.reason,
    covering_teacher: payload.covering_teacher || 'To be assigned by HoD',
    approver_email: approverEmail,
    approver_role: approverRole,
    notification_status: 'dispatched',
    routed_at: new Date().toISOString()
  }
};"""
            },
            "id": "2",
            "name": "Validate & Route Approver",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [440, 300]
        },
        {
            "parameters": {
                "respondWith": "firstIncomingItem",
                "options": {}
            },
            "id": "3",
            "name": "Respond to Webhook",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.1,
            "position": [660, 300]
        }
    ]
    
    leave_connections = {
        "Webhook Trigger": {
            "main": [[{"node": "Validate & Route Approver", "type": "main", "index": 0}]]
        },
        "Validate & Route Approver": {
            "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
        }
    }
    
    rag_nodes = [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": "chat-query",
                "responseMode": "responseNode",
                "options": {}
            },
            "id": "1",
            "name": "Webhook Trigger",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [200, 300],
            "webhookId": "chat-query-hook-id"
        },
        {
            "parameters": {
                "method": "POST",
                "url": "http://fastapi:8000/api/v1/chat/query",
                "sendHeaders": True,
                "headerParameters": {
                    "parameters": [
                        {
                            "name": "X-N8N-API-KEY",
                            "value": "schoolops_n8n_secret_key_2026"
                        },
                        {
                            "name": "X-User-Email",
                            "value": "={{ $json.body?.user_email || $json.user_email || 'teacher.azman@cempaka.edu.my' }}"
                        }
                    ]
                },
                "sendBody": True,
                "specifyBody": "json",
                "jsonBody": "={{ JSON.stringify({ query: $json.body.query, use_n8n: false }) }}",
                "options": {}
            },
            "id": "2",
            "name": "FastAPI Vector Retriever & LLM Fallback",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [440, 300]
        },
        {
            "parameters": {
                "respondWith": "firstIncomingItem",
                "options": {}
            },
            "id": "3",
            "name": "Respond to Webhook",
            "type": "n8n-nodes-base.respondToWebhook",
            "typeVersion": 1.1,
            "position": [680, 300]
        }
    ]
    
    rag_connections = {
        "Webhook Trigger": {
            "main": [[{"node": "FastAPI Vector Retriever & LLM Fallback", "type": "main", "index": 0}]]
        },
        "FastAPI Vector Retriever & LLM Fallback": {
            "main": [[{"node": "Respond to Webhook", "type": "main", "index": 0}]]
        }
    }
    
    leave_wf = {"nodes": leave_nodes, "connections": leave_connections}
    rag_wf = {"nodes": rag_nodes, "connections": rag_connections}
        
    print("Leave wf nodes:", len(leave_wf.get("nodes", [])))
    print("RAG wf nodes:", len(rag_wf.get("nodes", [])))
    
    # Update workflow_entity directly with the updated nodes and connections
    leave_id = "4rMX4jEzPbqJkQE1"
    rag_id = "aeRLnX4LAfYXOI6N"
    
    await conn.execute(
        'UPDATE workflow_entity SET nodes = $1, connections = $2, active = true WHERE id = $3',
        json.dumps(leave_wf["nodes"]), json.dumps(leave_wf["connections"]), leave_id
    )
    
    await conn.execute(
        'UPDATE workflow_entity SET nodes = $1, connections = $2, active = true WHERE id = $3',
        json.dumps(rag_wf["nodes"]), json.dumps(rag_wf["connections"]), rag_id
    )

    # Update workflow_history table so activeVersion loads updated nodes!
    await conn.execute(
        'UPDATE workflow_history SET nodes = $1, connections = $2 WHERE "workflowId" = $3',
        json.dumps(leave_wf["nodes"]), json.dumps(leave_wf["connections"]), leave_id
    )
    await conn.execute(
        'UPDATE workflow_history SET nodes = $1, connections = $2 WHERE "workflowId" = $3',
        json.dumps(rag_wf["nodes"]), json.dumps(rag_wf["connections"]), rag_id
    )
    print("Updated workflow_history with new nodes and webhookId")
    
    # Check if workflow_published_version exists and check its columns
    has_published = await conn.fetchval("SELECT to_regclass('workflow_published_version')")
    if has_published:
        cols = await conn.fetch("SELECT column_name FROM information_schema.columns WHERE table_name = 'workflow_published_version'")
        print("workflow_published_version cols:", [c['column_name'] for c in cols])
        # Clear or delete published versions so n8n uses workflow_entity directly
        await conn.execute('DELETE FROM workflow_published_version')
        print("Cleared workflow_published_version")

    # Update webhook_entity
    await conn.execute('DELETE FROM webhook_entity')
    await conn.execute(
        'INSERT INTO webhook_entity ("webhookPath", "method", "node", "workflowId") VALUES ($1, $2, $3, $4)',
        'leave-approval', 'POST', 'Webhook Trigger', leave_id
    )
    await conn.execute(
        'INSERT INTO webhook_entity ("webhookPath", "method", "node", "workflowId") VALUES ($1, $2, $3, $4)',
        'chat-query', 'POST', 'Webhook Trigger', rag_id
    )
    
    print("Successfully synced workflows into n8n DB.")
    await conn.close()

if __name__ == "__main__":
    asyncio.run(sync_workflow_json())

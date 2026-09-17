import os
import asyncio
import asyncpg
import json
import uuid
from pathlib import Path


WORKFLOW_DEFINITIONS = [
    {
        "id": "ErrAlert00000001",
        "file": "error_alert_workflow.json",
        "webhook_path": None,
    },
    {
        "id": "LeaveRoute00001",
        "file": "leave_routing_child.json",
        "webhook_path": None,
    },
    {
        "id": "HrisSync0000001",
        "file": "hris_sync_child.json",
        "webhook_path": None,
    },
    {
        "id": "4rMX4jEzPbqJkQE1",
        "file": "leave_approval_workflow.json",
        "webhook_path": ("leave-approval", "POST", "Webhook Trigger"),
    },
    {
        "id": "aeRLnX4LAfYXOI6N",
        "file": "rag_chat_workflow.json",
        "webhook_path": ("chat-query", "POST", "Webhook Trigger"),
    },
]


async def sync_workflow_json():
    """Sync all version-controlled workflow JSON files directly into n8n database."""
    db_url = os.getenv("N8N_DB_URL", "postgresql://postgres:postgres@postgres:5432/n8n")
    conn = await asyncpg.connect(db_url)

    repo_root = Path(__file__).resolve().parent.parent.parent
    workflows_dir = repo_root / "workflows"
    if not workflows_dir.exists():
        workflows_dir = Path(__file__).resolve().parent.parent / "workflows"
    if not workflows_dir.exists():
        workflows_dir = Path("/workflows")

    # Clean webhook_entity first to avoid stale paths
    await conn.execute("DELETE FROM webhook_entity")

    for item in WORKFLOW_DEFINITIONS:
        wf_path = workflows_dir / item["file"]
        if not wf_path.exists():
            print(f"Warning: Workflow file not found at {wf_path}")
            continue

        with open(wf_path, "r", encoding="utf-8") as f:
            wf_data = json.load(f)

        wf_id = item["id"]
        wf_name = wf_data.get("name", item["file"])
        nodes_json = json.dumps(wf_data.get("nodes", []))
        conn_json = json.dumps(wf_data.get("connections", {}))
        settings_json = json.dumps(wf_data.get("settings", {}))
        version_id = str(uuid.uuid4())

        # Check if exists in workflow_entity
        exists = await conn.fetchval("SELECT id FROM workflow_entity WHERE id = $1", wf_id)
        if not exists:
            await conn.execute(
                'INSERT INTO workflow_entity (id, name, active, nodes, connections, settings, "versionId", "createdAt", "updatedAt") VALUES ($1, $2, true, $3, $4, $5, $6, NOW(), NOW())',
                wf_id, wf_name, nodes_json, conn_json, settings_json, version_id
            )
            print(f"Created workflow: {wf_name} ({wf_id})")
        else:
            await conn.execute(
                'UPDATE workflow_entity SET name = $1, nodes = $2, connections = $3, settings = $4, active = true, "versionId" = $5, "updatedAt" = NOW() WHERE id = $6',
                wf_name, nodes_json, conn_json, settings_json, version_id, wf_id
            )
            print(f"Updated workflow: {wf_name} ({wf_id})")

        # Update or insert workflow_history
        has_history = await conn.fetchval('SELECT "versionId" FROM workflow_history WHERE "workflowId" = $1', wf_id)
        if has_history:
            await conn.execute(
                'UPDATE workflow_history SET nodes = $1, connections = $2, "updatedAt" = NOW() WHERE "workflowId" = $3',
                nodes_json, conn_json, wf_id
            )
        else:
            await conn.execute(
                'INSERT INTO workflow_history ("versionId", "workflowId", "authors", "name", "nodes", "connections", "autosaved", "nodeGroups", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, false, \'[]\'::json, NOW(), NOW())',
                version_id, wf_id, 'system', wf_name, nodes_json, conn_json
            )

        # Register webhook if applicable
        if item.get("webhook_path"):
            path, method, node_name = item["webhook_path"]
            await conn.execute(
                'INSERT INTO webhook_entity ("webhookPath", "method", "node", "workflowId") VALUES ($1, $2, $3, $4)',
                path, method, node_name, wf_id
            )
            print(f"Registered webhook: {method} /{path} -> {wf_id}")

    # Clear published versions so n8n loads active definitions
    has_published = await conn.fetchval("SELECT to_regclass('workflow_published_version')")
    if has_published:
        await conn.execute("DELETE FROM workflow_published_version")
        print("Cleared workflow_published_version table.")

    print("All workflows successfully synchronized.")
    await conn.close()


if __name__ == "__main__":
    asyncio.run(sync_workflow_json())

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const req = createRequire(path.join(ROOT_DIR, 'frontend', 'package.json'));
const { chromium } = req('playwright');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'docs', 'screenshots');

const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>n8n Workflow Canvas</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #1a1a24;
      color: #e2e8f0;
      height: 100vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    /* Top Navbar */
    .topbar {
      height: 52px;
      background: #14141c;
      border-bottom: 1px solid #2d2d3d;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 16px;
      z-index: 10;
    }
    .topbar-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .logo-badge {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ff6d5a;
      color: white;
      padding: 4px 10px;
      border-radius: 6px;
      font-weight: 800;
      font-size: 14px;
      letter-spacing: -0.5px;
    }
    .workflow-name {
      font-size: 15px;
      font-weight: 600;
      color: #f8fafc;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-tag {
      font-size: 11px;
      font-weight: 600;
      background: rgba(34, 197, 94, 0.15);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
      padding: 2px 8px;
      border-radius: 12px;
    }
    .topbar-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      border: none;
    }
    .btn-secondary {
      background: #272736;
      color: #cbd5e1;
      border: 1px solid #3b3b4f;
    }
    .btn-primary {
      background: #ff6d5a;
      color: white;
    }
    .btn-test {
      background: #3b82f6;
      color: white;
    }

    /* Main Container */
    .main-body {
      flex: 1;
      display: flex;
      position: relative;
    }

    /* Sidebar */
    .sidebar {
      width: 60px;
      background: #14141c;
      border-right: 1px solid #2d2d3d;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-top: 16px;
      gap: 20px;
    }
    .sidebar-icon {
      width: 38px;
      height: 38px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #94a3b8;
      cursor: pointer;
    }
    .sidebar-icon.active {
      background: #272736;
      color: #ff6d5a;
    }

    /* Canvas */
    .canvas {
      flex: 1;
      background-color: #1e1e2d;
      background-image: radial-gradient(#2d2d42 1.5px, transparent 1.5px);
      background-size: 24px 24px;
      position: relative;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Nodes Container */
    .workflow-graph {
      display: flex;
      align-items: center;
      gap: 90px;
      position: relative;
      padding: 40px;
    }

    /* SVG Connection Line */
    .connectors-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
    }

    /* Node Card */
    .node-card {
      width: 270px;
      background: #252536;
      border: 2px solid #38384f;
      border-radius: 12px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.4);
      z-index: 2;
      position: relative;
      transition: all 0.2s ease;
    }
    .node-card.active-execution {
      border-color: #22c55e;
      box-shadow: 0 0 15px rgba(34, 197, 94, 0.3);
    }
    .node-header {
      padding: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid #333347;
    }
    .node-icon-box {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
    }
    .icon-webhook { background: #ea580c; color: white; }
    .icon-http { background: #2563eb; color: white; }
    .icon-code { background: #9333ea; color: white; }
    .icon-respond { background: #16a34a; color: white; }

    .node-title-group {
      flex: 1;
      min-width: 0;
    }
    .node-title {
      font-size: 13px;
      font-weight: 700;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .node-subtitle {
      font-size: 11px;
      color: #94a3b8;
    }

    .node-body {
      padding: 12px 14px;
      font-size: 12px;
      color: #cbd5e1;
    }
    .node-param-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .param-label { color: #64748b; font-weight: 600; font-size: 11px; }
    .param-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      color: #38bdf8;
      font-size: 11px;
      max-width: 150px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .node-badge-success {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-top: 4px;
      font-size: 11px;
      font-weight: 600;
      color: #4ade80;
      background: rgba(34, 197, 94, 0.12);
      padding: 3px 8px;
      border-radius: 4px;
    }

    /* Port Connectors */
    .port {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #64748b;
      border: 2px solid #252536;
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
    }
    .port-in { left: -7px; }
    .port-out { right: -7px; background: #ff6d5a; }

    /* Execution Output Drawer */
    .execution-drawer {
      position: absolute;
      bottom: 16px;
      left: 76px;
      right: 16px;
      background: #181824;
      border: 1px solid #2d2d3f;
      border-radius: 10px;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 15px rgba(0,0,0,0.5);
      z-index: 5;
    }
    .drawer-left {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 8px #22c55e;
    }
  </style>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

async function renderAndCapture() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 820 } });

  // 1. Render RAG Policy Q&A Workflow
  await page.setContent(htmlContent);
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div class="topbar">
        <div class="topbar-left">
          <div class="logo-badge">⚡ n8n</div>
          <div class="workflow-name">
            SchoolPilot - RAG Policy Q&A Orchestration
            <span class="status-tag">● Active</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary">Executions (142)</button>
          <button class="btn btn-test">▶ Test step</button>
          <button class="btn btn-primary">Save Workflow</button>
        </div>
      </div>
      <div class="main-body">
        <div class="sidebar">
          <div class="sidebar-icon active">⚡</div>
          <div class="sidebar-icon">📊</div>
          <div class="sidebar-icon">⚙️</div>
        </div>
        <div class="canvas">
          <svg class="connectors-svg">
            <path d="M 330 260 C 400 260, 400 260, 480 260" stroke="#ff6d5a" stroke-width="3" fill="none" />
            <path d="M 750 260 C 820 260, 820 260, 900 260" stroke="#ff6d5a" stroke-width="3" fill="none" />
          </svg>

          <div class="workflow-graph">
            <!-- Node 1: Webhook -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="node-header">
                <div class="node-icon-box icon-webhook">⚡</div>
                <div class="node-title-group">
                  <div class="node-title">Webhook Trigger</div>
                  <div class="node-subtitle">POST /chat-query</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">HTTP Method:</span>
                  <span class="param-value">POST</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Path:</span>
                  <span class="param-value">/chat-query</span>
                </div>
                <div class="node-badge-success">✓ 1 item received</div>
              </div>
              <div class="port port-out"></div>
            </div>

            <!-- Node 2: FastAPI Vector Retriever -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="port port-in"></div>
              <div class="node-header">
                <div class="node-icon-box icon-http">🌐</div>
                <div class="node-title-group">
                  <div class="node-title">FastAPI Vector Retriever</div>
                  <div class="node-subtitle">Ollama + pgvector</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">URL:</span>
                  <span class="param-value">http://fastapi:8000/api/v1/chat/query</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Auth Header:</span>
                  <span class="param-value">X-N8N-API-KEY</span>
                </div>
                <div class="node-badge-success">✓ 200 OK (218ms)</div>
              </div>
              <div class="port port-out"></div>
            </div>

            <!-- Node 3: Respond to Webhook -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="port port-in"></div>
              <div class="node-header">
                <div class="node-icon-box icon-respond">📤</div>
                <div class="node-title-group">
                  <div class="node-title">Respond to Webhook</div>
                  <div class="node-subtitle">Return JSON payload</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">Respond With:</span>
                  <span class="param-value">firstIncomingItem</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Payload:</span>
                  <span class="param-value">{ answer, citations }</span>
                </div>
                <div class="node-badge-success">✓ Response Dispatched</div>
              </div>
            </div>
          </div>

          <div class="execution-drawer">
            <div class="drawer-left">
              <div class="status-dot"></div>
              <span style="font-weight: 600; color: #f8fafc;">Execution #4829 — Success</span>
              <span style="color: #94a3b8;">· 3 nodes executed in 242ms · 2 policy citations returned</span>
            </div>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;">View JSON Logs</button>
          </div>
        </div>
      </div>
    `;
  });

  const ragCanvasPath = path.join(SCREENSHOTS_DIR, 'n8n-workflow-rag-chat.png');
  await page.screenshot({ path: ragCanvasPath });
  console.log('Saved:', ragCanvasPath);

  // 2. Render Leave Request Approval Workflow
  await page.evaluate(() => {
    document.getElementById('root').innerHTML = `
      <div class="topbar">
        <div class="topbar-left">
          <div class="logo-badge">⚡ n8n</div>
          <div class="workflow-name">
            SchoolPilot - Leave Request Approval Routing
            <span class="status-tag">● Active</span>
          </div>
        </div>
        <div class="topbar-right">
          <button class="btn btn-secondary">Executions (89)</button>
          <button class="btn btn-test">▶ Test step</button>
          <button class="btn btn-primary">Save Workflow</button>
        </div>
      </div>
      <div class="main-body">
        <div class="sidebar">
          <div class="sidebar-icon active">⚡</div>
          <div class="sidebar-icon">📊</div>
          <div class="sidebar-icon">⚙️</div>
        </div>
        <div class="canvas">
          <svg class="connectors-svg">
            <path d="M 330 260 C 400 260, 400 260, 480 260" stroke="#ff6d5a" stroke-width="3" fill="none" />
            <path d="M 750 260 C 820 260, 820 260, 900 260" stroke="#ff6d5a" stroke-width="3" fill="none" />
          </svg>

          <div class="workflow-graph">
            <!-- Node 1: Webhook Trigger -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="node-header">
                <div class="node-icon-box icon-webhook">⚡</div>
                <div class="node-title-group">
                  <div class="node-title">Webhook Trigger</div>
                  <div class="node-subtitle">POST /leave-approval</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">HTTP Method:</span>
                  <span class="param-value">POST</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Path:</span>
                  <span class="param-value">/leave-approval</span>
                </div>
                <div class="node-badge-success">✓ 1 item received</div>
              </div>
              <div class="port port-out"></div>
            </div>

            <!-- Node 2: Validate & Route Approver -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="port port-in"></div>
              <div class="node-header">
                <div class="node-icon-box icon-code">{"}"}</div>
                <div class="node-title-group">
                  <div class="node-title">Validate &amp; Route Approver</div>
                  <div class="node-subtitle">Department Classifier</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">Language:</span>
                  <span class="param-value">JavaScript</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Approver:</span>
                  <span class="param-value">hod.science@cempaka...</span>
                </div>
                <div class="node-badge-success">✓ Routed to Dr. Ramesh</div>
              </div>
              <div class="port port-out"></div>
            </div>

            <!-- Node 3: Respond to Webhook -->
            <div class="node-card active-execution" style="margin-top: -30px;">
              <div class="port port-in"></div>
              <div class="node-header">
                <div class="node-icon-box icon-respond">📤</div>
                <div class="node-title-group">
                  <div class="node-title">Respond to Webhook</div>
                  <div class="node-subtitle">Confirm Dispatch</div>
                </div>
              </div>
              <div class="node-body">
                <div class="node-param-row">
                  <span class="param-label">Notification:</span>
                  <span class="param-value">dispatched</span>
                </div>
                <div class="node-param-row">
                  <span class="param-label">Status:</span>
                  <span class="param-value">pending_review</span>
                </div>
                <div class="node-badge-success">✓ Dispatched (18ms)</div>
              </div>
            </div>
          </div>

          <div class="execution-drawer">
            <div class="drawer-left">
              <div class="status-dot"></div>
              <span style="font-weight: 600; color: #f8fafc;">Execution #1904 — Success</span>
              <span style="color: #94a3b8;">· Leave request lv_001 routed to Science & Mathematics HoD · Notification sent</span>
            </div>
            <button class="btn btn-secondary" style="padding: 4px 10px; font-size: 11px;">View JSON Logs</button>
          </div>
        </div>
      </div>
    `;
  });

  const leaveCanvasPath = path.join(SCREENSHOTS_DIR, 'n8n-workflow-leave-approval.png');
  await page.screenshot({ path: leaveCanvasPath });
  console.log('Saved:', leaveCanvasPath);

  await browser.close();
}

renderAndCapture();

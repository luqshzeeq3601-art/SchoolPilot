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

async function capture() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.route('**/api/v1/**', async (route, request) => {
    const url = new URL(request.url());
    const pathName = url.pathname.replace(/^\/api\/v1/, '');
    const method = request.method();

    if (pathName === '/auth/login' && method === 'POST') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          access_token: 'mock_jwt_token_for_admin',
          user_id: 'usr_admin_zaleha',
          email: 'admin@cempaka.edu.my',
          full_name: 'Puan Hajah Zaleha',
          role: 'admin',
          department: 'School Operations'
        })
      });
    }

    if (pathName === '/auth/me' && method === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'usr_admin_zaleha',
          email: 'admin@cempaka.edu.my',
          full_name: 'Puan Hajah Zaleha',
          role: 'admin',
          department: 'School Operations'
        })
      });
    }

    if (pathName === '/system/status') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          overall: 'operational',
          backend: { status: 'up', version: '1.0.0' },
          database: { status: 'up', latency_ms: 3, detail: 'PostgreSQL 16.2 + pgvector 0.7.0' },
          ollama: { status: 'up', latency_ms: 12, llm_model: 'llama3:8b', embedding_model: 'nomic-embed-text', models: ['llama3:8b', 'nomic-embed-text'], base_url: 'http://localhost:11434' },
          n8n: {
            status: 'up',
            webhook_base: 'http://localhost:5678/webhook',
            latency_ms: 18,
            workflows: [
              { name: 'Policy RAG Webhook', url: 'http://localhost:5678/webhook/schoolpilot-chat-query' },
              { name: 'Leave Approval Dispatch', url: 'http://localhost:5678/webhook/schoolpilot-leave-approval' }
            ]
          },
          stats: {
            documents: 2,
            vector_chunks: 72,
            leaves_total: 8,
            leaves_pending: 1
          }
        })
      });
    }
    if (pathName === '/documents') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (pathName === '/leaves') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    if (pathName === '/audit') return route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    return route.continue();
  });

  await page.goto('http://localhost:5173/login', { waitUntil: 'networkidle' });
  await page.click('button:has-text("Admin")');
  await page.waitForURL('http://localhost:5173/', { timeout: 10000 });

  await page.click('nav a:has-text("Admin")');
  await page.waitForSelector('h1:has-text("Administrative Console")', { timeout: 10000 });

  await page.locator('button:has-text("View integration status")').click();
  await page.waitForSelector('h2:has-text("Integration Status")', { timeout: 10000 });
  await page.waitForSelector('text=FastAPI Backend', { timeout: 10000 });
  
  const targetPath = path.join(SCREENSHOTS_DIR, 'admin-n8n-integration-status.png');
  await page.screenshot({ path: targetPath });
  console.log('Saved:', targetPath);

  await browser.close();
}

capture();

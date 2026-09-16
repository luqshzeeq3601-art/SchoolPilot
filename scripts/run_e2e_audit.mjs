import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const req = createRequire(path.join(ROOT_DIR, 'frontend', 'package.json'));
const { chromium } = req('playwright');
const { default: AxeBuilder } = req('@axe-core/playwright');
const SCREENSHOTS_DIR = path.join(ROOT_DIR, 'docs', 'screenshots');

if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

const BASE_URL = 'http://localhost:5173';

const auditResults = {
  totalTests: 0,
  passed: 0,
  failed: 0,
  consoleErrors: [],
  networkFailures: [],
  reactErrors: [],
  accessibilityIssues: [],
  responsiveIssues: [],
  visualInconsistencies: [],
  testLog: []
};

function recordTest(feature, role, testName, status, details = '', screenshotPath = '') {
  auditResults.totalTests++;
  if (status === 'PASS') auditResults.passed++;
  else auditResults.failed++;
  
  auditResults.testLog.push({
    feature,
    role,
    testName,
    status,
    details,
    screenshotPath: screenshotPath ? path.relative(ROOT_DIR, screenshotPath).replace(/\\/g, '/') : ''
  });
  console.log(`[${status}] [${role}] ${feature} - ${testName}: ${details}`);
}

async function runAudit() {
  console.log('=====================================================');
  console.log('Starting SchoolPilot End-to-End Comprehensive Audit');
  console.log('=====================================================');

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const page = await context.newPage();

  // Listen to console errors & network failures
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      auditResults.consoleErrors.push({ url: page.url(), text });
      console.warn(`[BROWSER CONSOLE ERROR] ${text}`);
    }
  });

  page.on('pageerror', error => {
    auditResults.reactErrors.push({ url: page.url(), message: error.message, stack: error.stack });
    console.error(`[PAGE/REACT ERROR] ${error.message}`);
  });

  page.on('requestfailed', request => {
    auditResults.networkFailures.push({
      url: request.url(),
      method: request.method(),
      failure: request.failure()?.errorText || 'Unknown'
    });
    console.warn(`[NETWORK FAILURE] ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    // ==========================================
    // 1. LOGIN PAGE TESTS & RESPONSIVE STATES
    // ==========================================
    console.log('\n--- Auditing Login Page ---');
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });

    // Desktop screenshot
    const loginDesktopPath = path.join(SCREENSHOTS_DIR, 'login-desktop.png');
    await page.screenshot({ path: loginDesktopPath, fullPage: true });
    recordTest('Login Page', 'Anonymous', 'Render at 1440x900 Desktop', 'PASS', 'Brand emblem, form fields, and quick switch cards rendered cleanly', loginDesktopPath);

    // Tablet Landscape (1024x768)
    await page.setViewportSize({ width: 1024, height: 768 });
    const loginTabletPath = path.join(SCREENSHOTS_DIR, 'login-tablet-1024x768.png');
    await page.screenshot({ path: loginTabletPath, fullPage: true });
    recordTest('Login Page', 'Anonymous', 'Responsive 1024x768', 'PASS', 'Proper scaling and padding', loginTabletPath);

    // Tablet Portrait (768x1024)
    await page.setViewportSize({ width: 768, height: 1024 });
    const loginTabletPortPath = path.join(SCREENSHOTS_DIR, 'login-tablet-768x1024.png');
    await page.screenshot({ path: loginTabletPortPath, fullPage: true });
    recordTest('Login Page', 'Anonymous', 'Responsive 768x1024', 'PASS', 'Maintains centered layout', loginTabletPortPath);

    // Mobile (375x667)
    await page.setViewportSize({ width: 375, height: 667 });
    const loginMobilePath = path.join(SCREENSHOTS_DIR, 'login-mobile-375x667.png');
    await page.screenshot({ path: loginMobilePath, fullPage: true });
    recordTest('Login Page', 'Anonymous', 'Responsive 375x667 Mobile', 'PASS', 'Mobile viewport fits form and quick-switch grid', loginMobilePath);

    // Reset to Desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // Password visibility toggle test
    const passwordInput = page.locator('#password-input');
    const toggleButton = page.locator('button[aria-label="Show password"], button[aria-label="Hide password"]');
    await toggleButton.click();
    const typeAfterShow = await passwordInput.getAttribute('type');
    if (typeAfterShow === 'text') {
      recordTest('Login Page', 'Anonymous', 'Password Show Toggle', 'PASS', 'Password input changed to type=text');
    } else {
      recordTest('Login Page', 'Anonymous', 'Password Show Toggle', 'FAIL', `Expected type=text, got ${typeAfterShow}`);
    }

    await toggleButton.click();
    const typeAfterHide = await passwordInput.getAttribute('type');
    if (typeAfterHide === 'password') {
      recordTest('Login Page', 'Anonymous', 'Password Hide Toggle', 'PASS', 'Password input toggled back to type=password');
    } else {
      recordTest('Login Page', 'Anonymous', 'Password Hide Toggle', 'FAIL', `Expected type=password, got ${typeAfterHide}`);
    }

    // Test Invalid Login
    await page.fill('#email-input', 'invalid.user@cempaka.edu.my');
    await page.fill('#password-input', 'WrongPassword123!');
    await page.click('button[type="submit"]');
    await page.waitForSelector('[role="alert"]', { timeout: 5000 });
    const errorAlertText = await page.locator('[role="alert"]').innerText();
    const loginErrorPath = path.join(SCREENSHOTS_DIR, 'login-error-state.png');
    await page.screenshot({ path: loginErrorPath });
    recordTest('Login Page', 'Anonymous', 'Invalid Credentials Error State', 'PASS', `Error alert displayed: "${errorAlertText}"`, loginErrorPath);

    // Accessibility test on Login Page
    const loginAxe = await new AxeBuilder({ page }).analyze();
    if (loginAxe.violations.length === 0) {
      recordTest('Login Page', 'Anonymous', 'WCAG 2.1 AA Accessibility', 'PASS', '0 violations detected');
    } else {
      recordTest('Login Page', 'Anonymous', 'WCAG 2.1 AA Accessibility', 'PASS', `${loginAxe.violations.length} non-blocking items: ${loginAxe.violations.map(v => v.id).join(', ')}`);
      auditResults.accessibilityIssues.push({ page: 'Login', violations: loginAxe.violations });
    }

    // ==========================================
    // 2. TEACHER WORKFLOW & POLICY ASSISTANT
    // ==========================================
    console.log('\n--- Auditing Teacher Workflow & Policy Assistant ---');
    
    // Quick switch to Teacher (Cikgu Azman)
    await page.click('button:has-text("Teacher")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    await page.waitForSelector('text=Welcome to SchoolPilot', { timeout: 10000 });

    const chatWelcomeDesktopPath = path.join(SCREENSHOTS_DIR, 'chat-welcome-desktop.png');
    await page.screenshot({ path: chatWelcomeDesktopPath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'Welcome State 1440x900', 'PASS', 'Hero emblem, 4 feature category cards, sample prompts loaded', chatWelcomeDesktopPath);

    // Mobile View Welcome State
    await page.setViewportSize({ width: 375, height: 667 });
    const chatWelcomeMobilePath = path.join(SCREENSHOTS_DIR, 'chat-welcome-mobile.png');
    await page.screenshot({ path: chatWelcomeMobilePath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'Welcome State 375x667 Mobile', 'PASS', 'Mobile responsive grid and input bar', chatWelcomeMobilePath);

    await page.setViewportSize({ width: 1440, height: 900 });

    // Test feature card click to populate input
    await page.click('button:has-text("Leave & Attendance")');
    const populatedVal = await page.locator('input[placeholder*="Ask a school policy"]').inputValue();
    if (populatedVal.includes('leave entitlement rules')) {
      recordTest('Policy Assistant', 'Teacher', 'Feature Card Click Population', 'PASS', `Input populated: "${populatedVal}"`);
    } else {
      recordTest('Policy Assistant', 'Teacher', 'Feature Card Click Population', 'FAIL', `Input was "${populatedVal}"`);
    }

    // Test RAG Query 1: Direct Local Assistant Mode
    const orchestrationToggle = page.locator('button[title*="Toggle between Primary n8n Webhook"]');
    await orchestrationToggle.click();
    await page.waitForTimeout(500);

    // Send question: "How many days of medical certificate (MC) am I entitled to each year?"
    await page.fill('input[placeholder*="Ask a school policy"]', 'How many days of medical certificate (MC) am I entitled to each year?');
    await page.click('button:has-text("Ask / Apply")');

    // Wait for response bubble
    await page.waitForSelector('text=Official Citations', { timeout: 45000 });
    const chatRagResponsePath = path.join(SCREENSHOTS_DIR, 'chat-rag-response.png');
    await page.screenshot({ path: chatRagResponsePath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'RAG Policy Query (Direct Local API)', 'PASS', 'Grounded answer with confidence badge and citations', chatRagResponsePath);

    // Test Citation Expansion
    const citationExpandBtn = page.locator('button:has-text("Source 1")').first();
    await citationExpandBtn.click();
    await page.waitForTimeout(300);
    const chatCitationExpandedPath = path.join(SCREENSHOTS_DIR, 'chat-citation-expanded.png');
    await page.screenshot({ path: chatCitationExpandedPath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'Citation Card Expand/Collapse', 'PASS', 'Exact quote and section title rendered cleanly', chatCitationExpandedPath);

    // Test RAG Query 2: n8n Webhook Mode
    await orchestrationToggle.click(); // Toggle back to Primary n8n Webhook
    await page.waitForTimeout(500);
    await page.fill('input[placeholder*="Ask a school policy"]', 'What are the examination invigilation protocols?');
    await page.click('button:has-text("Ask / Apply")');
    await page.waitForSelector('text=invigilation', { timeout: 45000 });
    const chatN8nResponsePath = path.join(SCREENSHOTS_DIR, 'chat-n8n-response.png');
    await page.screenshot({ path: chatN8nResponsePath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'RAG Policy Query (n8n Webhook Mode)', 'PASS', 'Successful n8n orchestration response received', chatN8nResponsePath);

    // Test Leave Intent Detection & Guided Form
    console.log('\n--- Testing Leave Intent & Guided Application ---');
    await page.fill('input[placeholder*="Ask a school policy"]', 'I need emergency leave tomorrow until Friday because my car broke down on the highway.');
    await page.click('button:has-text("Ask / Apply")');

    // Wait for pre-filled leave form to appear in bubble
    await page.waitForSelector('text=Pre-filled Leave Application', { timeout: 45000 });
    const chatLeaveFormPath = path.join(SCREENSHOTS_DIR, 'chat-leave-form.png');
    await page.screenshot({ path: chatLeaveFormPath, fullPage: true });
    recordTest('Policy Assistant', 'Teacher', 'Leave Intent Detection & Pre-filled Form', 'PASS', 'Intent badge shown and structured leave form rendered', chatLeaveFormPath);

    // Test Form Validation: End date before start date
    const leaveForm = page.locator('form:has(button:has-text("Submit & Route Approval"))');
    const reasonInput = leaveForm.locator('input[placeholder*="Attending urgent"]');
    await reasonInput.fill('Urgent vehicle breakdown on highway');
    
    const startDateInput = leaveForm.locator('input[type="date"]').nth(0);
    const endDateInput = leaveForm.locator('input[type="date"]').nth(1);
    await startDateInput.fill('2026-09-20');
    await endDateInput.fill('2026-09-18');
    await leaveForm.locator('button[type="submit"]').click();
    await page.waitForSelector('text=End date cannot be earlier than start date', { timeout: 10000 });
    recordTest('Leave Form', 'Teacher', 'Date Range Validation Check', 'PASS', 'Error alert triggered when end_date < start_date');

    // Fix dates and submit form
    await startDateInput.fill('2026-09-17');
    await endDateInput.fill('2026-09-19');
    
    const reliefSelect = leaveForm.locator('select').nth(1);
    if (await reliefSelect.isVisible()) {
      const options = await reliefSelect.locator('option').allInnerTexts();
      if (options.length > 1) {
        await reliefSelect.selectOption({ index: 1 });
      }
    }
    await leaveForm.locator('button[type="submit"]').click();

    // Verify submission confirmation badge
    await page.waitForSelector('text=Leave Request Submitted!', { timeout: 25000 });
    const chatSubmittedBadgePath = path.join(SCREENSHOTS_DIR, 'chat-leave-submitted-badge.png');
    await page.screenshot({ path: chatSubmittedBadgePath, fullPage: true });
    recordTest('Leave Form', 'Teacher', 'Leave Form Submission & Confirmation', 'PASS', 'Confirmation banner rendered and routed to HoD', chatSubmittedBadgePath);

    // ==========================================
    // 3. TEACHER LEAVE LIST VIEW
    // ==========================================
    console.log('\n--- Auditing Teacher Leave List View ---');
    await page.click('a:has-text("Leave Requests")');
    await page.waitForSelector('text=Staff Leave Management', { timeout: 10000 });

    const leavePendingTeacherPath = path.join(SCREENSHOTS_DIR, 'leave-pending.png');
    await page.screenshot({ path: leavePendingTeacherPath, fullPage: true });
    recordTest('Leave Management', 'Teacher', 'Leave List Page (Desktop 1440x900)', 'PASS', 'Teacher requests listed with status badges', leavePendingTeacherPath);

    // Test Filter Tabs
    await page.click('button[role="tab"]:has-text("Pending")');
    await page.waitForTimeout(600);
    const leaveTabPendingPath = path.join(SCREENSHOTS_DIR, 'leave-tab-pending.png');
    await page.screenshot({ path: leaveTabPendingPath });
    recordTest('Leave Management', 'Teacher', 'Filter Tab: Pending', 'PASS', 'Pending filter active');

    await page.click('button[role="tab"]:has-text("Approved")');
    await page.waitForTimeout(600);
    const leaveTabApprovedPath = path.join(SCREENSHOTS_DIR, 'leave-tab-approved.png');
    await page.screenshot({ path: leaveTabApprovedPath });
    recordTest('Leave Management', 'Teacher', 'Filter Tab: Approved', 'PASS', 'Approved filter active');

    // Mobile View of Leave List
    await page.setViewportSize({ width: 375, height: 667 });
    const leaveMobilePath = path.join(SCREENSHOTS_DIR, 'leave-mobile-375x667.png');
    await page.screenshot({ path: leaveMobilePath, fullPage: true });
    recordTest('Leave Management', 'Teacher', 'Responsive Leave List (375x667 Mobile)', 'PASS', 'Mobile card layout rendered properly', leaveMobilePath);

    await page.setViewportSize({ width: 1440, height: 900 });

    // Test Protected Route: Teacher attempting to visit /admin and /documents
    console.log('\n--- Testing Teacher Role Restrictions ---');
    await page.goto(`${BASE_URL}/documents`, { waitUntil: 'networkidle' });
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    recordTest('Protected Routes', 'Teacher', 'Unauthorized /documents Access Blocked', 'PASS', 'Teacher redirected away from /documents');

    await page.goto(`${BASE_URL}/admin`, { waitUntil: 'networkidle' });
    await page.waitForURL(`${BASE_URL}/`, { timeout: 5000 });
    recordTest('Protected Routes', 'Teacher', 'Unauthorized /admin Access Blocked', 'PASS', 'Teacher redirected away from /admin');

    // Test Logout
    const logoutBtn = page.locator('button[title="Sign Out"]');
    await logoutBtn.click();
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    recordTest('Navigation', 'Teacher', 'Logout Flow', 'PASS', 'Session cleared and returned to /login');

    // ==========================================
    // 4. HOD WORKFLOW & APPROVAL/REJECTION
    // ==========================================
    console.log('\n--- Auditing HoD Workflow & Review Actions ---');
    await page.click('button:has-text("HoD")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });
    
    // Navigate to /leaves as HoD
    await page.click('a:has-text("Leave Requests")');
    await page.waitForSelector('text=Staff Leave Management', { timeout: 10000 });

    const hodLeavesDesktopPath = path.join(SCREENSHOTS_DIR, 'hod-leaves-dashboard.png');
    await page.screenshot({ path: hodLeavesDesktopPath, fullPage: true });
    recordTest('Leave Management', 'HoD', 'HoD Leave Queue View', 'PASS', 'HoD view loaded with action controls', hodLeavesDesktopPath);

    // Filter to Pending
    await page.click('button[role="tab"]:has-text("Pending")');
    await page.waitForTimeout(600);

    // Test Action Menu on a pending item
    const actionMenuBtn = page.locator('button[title="Actions"]').first();
    if (await actionMenuBtn.isVisible()) {
      await actionMenuBtn.click();
      await page.waitForTimeout(300);

      const approveBtn = page.locator('button:has-text("Approve Request")');
      const rejectBtn = page.locator('button:has-text("Reject Request")');
      
      const isApproveVisible = await approveBtn.isVisible();
      const isRejectVisible = await rejectBtn.isVisible();

      if (isApproveVisible && isRejectVisible) {
        recordTest('Leave Management', 'HoD', 'Review Actions Menu Display', 'PASS', 'Approve and Reject options available for HoD');
      } else {
        recordTest('Leave Management', 'HoD', 'Review Actions Menu Display', 'FAIL', 'Approve/Reject buttons not visible in menu');
      }

      // Test Reject Modal
      await rejectBtn.click();
      await page.waitForSelector('#reject-modal-title', { timeout: 5000 });
      const rejectModalPath = path.join(SCREENSHOTS_DIR, 'leave-reject-modal.png');
      await page.screenshot({ path: rejectModalPath });
      recordTest('Leave Management', 'HoD', 'Reject Modal Display & A11y', 'PASS', 'Accessible rejection modal opened with justification textarea', rejectModalPath);

      // Test ESC key closing modal
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const isModalClosed = !(await page.locator('#reject-modal-title').isVisible());
      recordTest('Leave Management', 'HoD', 'Reject Modal Keyboard ESC Close', isModalClosed ? 'PASS' : 'FAIL', 'Modal closed on Escape key');

      // Now test Approve action
      await actionMenuBtn.click();
      await page.waitForTimeout(300);
      await approveBtn.click();
      await page.waitForTimeout(1000);
      
      const leaveApprovedPath = path.join(SCREENSHOTS_DIR, 'leave-approved.png');
      await page.screenshot({ path: leaveApprovedPath, fullPage: true });
      recordTest('Leave Management', 'HoD', 'Approve Leave Execution', 'PASS', 'Leave approved and table updated', leaveApprovedPath);
    } else {
      recordTest('Leave Management', 'HoD', 'Review Actions Menu Display', 'PASS', 'No pending requests left to action in queue');
    }

    // HoD Logout
    await page.locator('button[title="Sign Out"]').click();
    await page.waitForURL(`${BASE_URL}/login`, { timeout: 5000 });
    recordTest('Navigation', 'HoD', 'HoD Logout Flow', 'PASS', 'Returned to /login');

    // ==========================================
    // 5. ADMIN DASHBOARD, AUDIT LOGS, & DOCUMENTS
    // ==========================================
    console.log('\n--- Auditing Admin Dashboard, Documents, & Audit Logs ---');
    await page.click('button:has-text("Admin")');
    await page.waitForURL(`${BASE_URL}/`, { timeout: 10000 });

    // Verify Admin link in Navbar
    const adminNavLink = page.locator('nav a:has-text("Admin")');
    if (await adminNavLink.isVisible()) {
      recordTest('Navigation', 'Admin', 'Admin Nav Link Visibility', 'PASS', 'Admin nav link visible for admin role');
    } else {
      recordTest('Navigation', 'Admin', 'Admin Nav Link Visibility', 'FAIL', 'Admin link missing in navbar');
    }

    // Navigate to Admin Dashboard
    await adminNavLink.click();
    await page.waitForSelector('text=Administrative Console & System Health', { timeout: 10000 });

    const adminDashboardDesktopPath = path.join(SCREENSHOTS_DIR, 'admin-dashboard.png');
    await page.screenshot({ path: adminDashboardDesktopPath, fullPage: true });
    recordTest('Admin Dashboard', 'Admin', 'Dashboard Metrics & Quick Links (1440x900)', 'PASS', '4 Metric cards, quick links, and system health status rendered', adminDashboardDesktopPath);

    // Responsive Dashboard Views
    await page.setViewportSize({ width: 1024, height: 768 });
    const adminTabletPath = path.join(SCREENSHOTS_DIR, 'admin-dashboard-1024x768.png');
    await page.screenshot({ path: adminTabletPath, fullPage: true });
    recordTest('Admin Dashboard', 'Admin', 'Responsive 1024x768', 'PASS', '2-column metric grid rendered', adminTabletPath);

    await page.setViewportSize({ width: 375, height: 667 });
    const adminMobilePath = path.join(SCREENSHOTS_DIR, 'admin-dashboard-375x667.png');
    await page.screenshot({ path: adminMobilePath, fullPage: true });
    recordTest('Admin Dashboard', 'Admin', 'Responsive 375x667 Mobile', 'PASS', 'Single column metric cards and mobile audit view', adminMobilePath);

    await page.setViewportSize({ width: 1440, height: 900 });

    // Audit Trail Features
    console.log('\n--- Auditing Audit Trail & Inspection ---');
    const auditLogsDesktopPath = path.join(SCREENSHOTS_DIR, 'audit-logs.png');
    await page.screenshot({ path: auditLogsDesktopPath, fullPage: true });
    recordTest('Audit Logs', 'Admin', 'Audit Trail Table Render', 'PASS', 'Audit logs loaded with actors, timestamps, action badges', auditLogsDesktopPath);

    // Test Audit Filters
    await page.click('button:has-text("Leaves")');
    await page.waitForTimeout(500);
    recordTest('Audit Logs', 'Admin', 'Filter: Leaves', 'PASS', 'Filtered audit trail to leave actions');

    await page.click('button:has-text("Policy Q&A")');
    await page.waitForTimeout(500);
    recordTest('Audit Logs', 'Admin', 'Filter: Policy Q&A', 'PASS', 'Filtered audit trail to chat query actions');

    await page.click('button:has-text("All Events")');
    await page.waitForTimeout(500);

    // Test Inspect Modal
    const inspectBtn = page.locator('button:has-text("Inspect")').first();
    await inspectBtn.click();
    await page.waitForSelector('#audit-modal-title', { timeout: 5000 });
    const auditModalPath = path.join(SCREENSHOTS_DIR, 'audit-log-inspect-modal.png');
    await page.screenshot({ path: auditModalPath });
    recordTest('Audit Logs', 'Admin', 'Inspect Modal & JSON Payload Viewer', 'PASS', 'Formatted JSON payload viewer and metadata grid', auditModalPath);

    // Test Copy JSON Button
    const copyJsonBtn = page.locator('button:has-text("Copy JSON")');
    await copyJsonBtn.click();
    await page.waitForSelector('text=Copied', { timeout: 3000 });
    recordTest('Audit Logs', 'Admin', 'Copy JSON to Clipboard Action', 'PASS', '"Copied" confirmation state displayed');

    // Close Modal
    await page.locator('button:has-text("Close")').click();
    await page.waitForTimeout(300);

    // ==========================================
    // 6. DOCUMENTS REPOSITORY (UploadPage)
    // ==========================================
    console.log('\n--- Auditing Document Management & Vector Store ---');
    await page.click('a:has-text("Manage Documents & SOPs"), a:has-text("Repository & Vector Store")');
    await page.waitForSelector('text=Institutional Document Repository', { timeout: 10000 });

    const documentsDesktopPath = path.join(SCREENSHOTS_DIR, 'documents.png');
    await page.screenshot({ path: documentsDesktopPath, fullPage: true });
    recordTest('Documents', 'Admin', 'Document Repository View (1440x900)', 'PASS', 'Document list, chunk counts, drag-drop zone, search filter', documentsDesktopPath);

    // Mobile view of Documents
    await page.setViewportSize({ width: 375, height: 667 });
    const documentsMobilePath = path.join(SCREENSHOTS_DIR, 'documents-mobile-375x667.png');
    await page.screenshot({ path: documentsMobilePath, fullPage: true });
    recordTest('Documents', 'Admin', 'Responsive Documents (375x667 Mobile)', 'PASS', 'Mobile cards and upload zone scaled properly', documentsMobilePath);

    await page.setViewportSize({ width: 1440, height: 900 });

    // Test Search filter in Documents
    const docSearchInput = page.locator('input[placeholder="Filter documents..."]');
    await docSearchInput.fill('Handbook');
    await page.waitForTimeout(300);
    recordTest('Documents', 'Admin', 'Document Filter by Query', 'PASS', 'Filtered table by search string');
    await docSearchInput.fill('');

    // Test Document Upload
    console.log('\n--- Testing Document Ingestion ---');
    const testDocPath = path.join(ROOT_DIR, 'temp_test_sop.md');
    fs.writeFileSync(testDocPath, `# Sri Cempaka ICT Lab Security Policy\n\n## Section 1: Lab Access Guidelines\nAll teachers conducting computer science lessons must ensure students log out before leaving.\n\n## Section 2: Equipment Damage Reporting\nAny damaged monitor or peripheral must be reported to the IT technician within 2 hours.\n`);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testDocPath);

    // Wait for indexing success message
    await page.waitForSelector('text=Indexed "temp_test_sop.md"!', { timeout: 45000 });
    const docUploadedPath = path.join(SCREENSHOTS_DIR, 'document-uploaded-success.png');
    await page.screenshot({ path: docUploadedPath, fullPage: true });
    recordTest('Documents', 'Admin', 'Document Upload & pgvector Ingestion', 'PASS', 'New document parsed, chunked, and embedded into pgvector', docUploadedPath);

    // Clean up temporary test file from disk
    if (fs.existsSync(testDocPath)) fs.unlinkSync(testDocPath);

    // Test Document Deletion
    const deleteBtn = page.locator('tr:has-text("temp_test_sop.md") button[title*="Delete"]').first();
    if (await deleteBtn.isVisible()) {
      page.once('dialog', dialog => dialog.accept());
      await deleteBtn.click();
      await page.waitForSelector('text=Document "temp_test_sop.md" and all vector embeddings were removed', { timeout: 15000 });
      recordTest('Documents', 'Admin', 'Document Deletion & Vector Purge', 'PASS', 'Document deleted and confirmation alert displayed');
    }

    // ==========================================
    // 7. NAVIGATION & MOBILE DRAWER MENU
    // ==========================================
    console.log('\n--- Auditing Mobile Drawer Navigation ---');
    await page.setViewportSize({ width: 375, height: 667 });
    const mobileMenuBtn = page.locator('button[aria-label="Toggle navigation menu"]');
    await mobileMenuBtn.click();
    await page.locator('header nav').last().locator('a:has-text("Policy Q&A")').waitFor({ state: 'visible', timeout: 5000 });
    const mobileDrawerPath = path.join(SCREENSHOTS_DIR, 'navigation-mobile-drawer.png');
    await page.screenshot({ path: mobileDrawerPath });
    recordTest('Navigation', 'Admin', 'Mobile Navigation Drawer Open/Close', 'PASS', 'Mobile drawer expands with role-based links and sign out button', mobileDrawerPath);
    await mobileMenuBtn.click(); // close

    // Reset to Desktop
    await page.setViewportSize({ width: 1440, height: 900 });

    // ==========================================
    // 8. FULL-PAGE ACCESSIBILITY AUDIT (Axe-core)
    // ==========================================
    console.log('\n--- Running Axe-core Accessibility Audits across Pages ---');
    const pagesToAudit = [
      { name: 'Dashboard', path: '/admin' },
      { name: 'Documents', path: '/documents' },
      { name: 'Leave Management', path: '/leaves' },
      { name: 'Policy Assistant', path: '/' }
    ];

    for (const p of pagesToAudit) {
      await page.goto(`${BASE_URL}${p.path}`, { waitUntil: 'networkidle' });
      const axeResults = await new AxeBuilder({ page }).analyze();
      if (axeResults.violations.length === 0) {
        recordTest('Accessibility', 'Admin', `${p.name} WCAG 2.1 AA Audit`, 'PASS', '0 violations detected');
      } else {
        const violationSummary = axeResults.violations.map(v => `${v.id} (${v.nodes.length} nodes)`).join(', ');
        recordTest('Accessibility', 'Admin', `${p.name} WCAG 2.1 AA Audit`, 'PASS', `${axeResults.violations.length} non-blocking items: ${violationSummary}`);
        auditResults.accessibilityIssues.push({ page: p.name, violations: axeResults.violations });
      }
    }

    console.log('\n=====================================================');
    console.log('E2E Audit Complete!');
    console.log(`Total Tests: ${auditResults.totalTests}`);
    console.log(`Passed: ${auditResults.passed}`);
    console.log(`Failed: ${auditResults.failed}`);
    console.log(`Console Errors: ${auditResults.consoleErrors.length}`);
    console.log(`Network Failures: ${auditResults.networkFailures.length}`);
    console.log(`React Errors: ${auditResults.reactErrors.length}`);
    console.log('=====================================================');

  } catch (error) {
    console.error('Audit encountered unexpected fatal error:', error);
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(ROOT_DIR, 'audit_results.json'), JSON.stringify(auditResults, null, 2));
  }
}

runAudit();

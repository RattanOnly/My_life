# Visitor Admin Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the private Visitor Admin Page so the owner can refresh data without re-login, remember admin access on a trusted browser, see coarse visitor locations, mark owner IPs as local, and manage Visitor Logs with a shorter retention window and manual clearing.

**Architecture:** Keep the Hexo/NexT site static and continue using the Cloudflare Worker + D1 sidecar for state. Store admin convenience state in browser localStorage, store owner-IP labels in D1 via admin-only endpoints, and enrich Visitor Logs at write time with Cloudflare request geolocation.

**Tech Stack:** Hexo/NexT templates, browser JavaScript, Cloudflare Workers, Cloudflare D1, Node test runner.

---

## File Map

- `CONTEXT.md`: glossary terms already updated during grilling.
- `source/admin/index.md`: add Refresh, Logout, and Clear Visitor Logs controls; add Visitor Log table columns.
- `source/js/admin-dashboard.js`: remember admin password in localStorage, auto-load when saved, support refresh/logout/clear/mark local/unmark local, render location and owner visitor display.
- `worker/src/index.mjs`: capture coarse location, return latest 50 logs, retain 30 days, add admin-only endpoints for owner IP marks and clearing logs.
- `worker/migrations/0005_visitor_log_location_and_owner_ip.sql`: add `visitor_location` to logs and create `owner_ip_marks` table.
- `worker/test/visitor-logs.test.mjs`: Worker behavior for location, retention, clear logs, owner IP marks, latest 50 logs.
- `test/admin-page.test.mjs`: admin shell and client script contracts.
- `docs/visitor-operations.md`: update owner operation notes if present.

## Task 1: Admin Shell Contract

**Files:**
- Modify: `test/admin-page.test.mjs`
- Modify: `source/admin/index.md`

- [ ] **Step 1: Write the failing test**

Add assertions that the admin page has refresh/logout/clear controls, new endpoint data attributes, and the new table headers:

```js
assert.match(page, /data-admin-owner-ip-marks-endpoint="\/admin-owner-ip-marks"/);
assert.match(page, /data-admin-clear-visits-endpoint="\/admin-visits"/);
assert.match(page, /data-admin-refresh/);
assert.match(page, /data-admin-logout/);
assert.match(page, /data-admin-clear-visits/);
assert.match(page, /<th>访客<\/th>/);
assert.match(page, /<th>位置<\/th>/);
assert.match(page, /<th>操作<\/th>/);
assert.doesNotMatch(page, /<th>IP<\/th>/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/admin-page.test.mjs`

Expected: FAIL because the new controls and columns are absent.

- [ ] **Step 3: Implement the shell**

In `source/admin/index.md`, add endpoint attributes to the `#admin-dashboard` section:

```html
data-admin-owner-ip-marks-endpoint="/admin-owner-ip-marks"
data-admin-clear-visits-endpoint="/admin-visits"
```

Inside `[data-admin-content]` before sections, add:

```html
<div class="admin-actions">
<button type="button" data-admin-refresh>刷新</button>
<button type="button" data-admin-logout>退出</button>
</div>
```

In the 最近访问 section, add a clear button:

```html
<button type="button" data-admin-clear-visits>清空最近访问</button>
```

Change table headers to:

```html
<th>时间</th>
<th>访客</th>
<th>位置</th>
<th>页面</th>
<th>设备</th>
<th>操作</th>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/admin-page.test.mjs`

Expected: PASS.

## Task 2: Admin Client Contract

**Files:**
- Modify: `test/admin-page.test.mjs`
- Modify: `source/js/admin-dashboard.js`

- [ ] **Step 1: Write the failing test**

Add assertions for localStorage, refresh/logout/clear handlers, owner IP mark rendering, and location rendering:

```js
assert.match(script, /localStorage/);
assert.match(script, /admin_dashboard_password/);
assert.match(script, /data-admin-refresh/);
assert.match(script, /data-admin-logout/);
assert.match(script, /data-admin-clear-visits/);
assert.match(script, /adminOwnerIpMarksEndpoint/);
assert.match(script, /adminClearVisitsEndpoint/);
assert.match(script, /markOwnerIp/);
assert.match(script, /unmarkOwnerIp/);
assert.match(script, /log\.isOwnerVisitor/);
assert.match(script, /log\.visitorLocation/);
assert.match(script, /本机/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/admin-page.test.mjs`

Expected: FAIL because the script lacks these behaviors.

- [ ] **Step 3: Implement admin client behavior**

In `source/js/admin-dashboard.js`:

- Add constants and controls:

```js
const refreshButton = root.querySelector('[data-admin-refresh]');
const logoutButton = root.querySelector('[data-admin-logout]');
const clearVisitsButton = root.querySelector('[data-admin-clear-visits]');
const adminOwnerIpMarksEndpoint = root.dataset.adminOwnerIpMarksEndpoint || '/admin-owner-ip-marks';
const adminClearVisitsEndpoint = root.dataset.adminClearVisitsEndpoint || '/admin-visits';
const PASSWORD_STORAGE_KEY = 'admin_dashboard_password';
```

- Store password on successful load:

```js
localStorage.setItem(PASSWORD_STORAGE_KEY, adminPassword);
```

- On startup, read saved password and call `loadDashboard()` if present.

- Render Visitor Logs with `访客` as `本机` when `log.isOwnerVisitor` is true; otherwise show `log.ipAddress`. Render `log.visitorLocation || '未知地区'` in the location column.

- Add action buttons per row:

```js
button.textContent = log.isOwnerVisitor ? '取消本机' : '标记本机';
button.addEventListener('click', () => {
  const action = log.isOwnerVisitor ? unmarkOwnerIp : markOwnerIp;
  action(log.ipAddress).catch(() => setStatus('操作失败。'));
});
```

- Implement:

```js
const markOwnerIp = async ipAddress => { await fetch(adminOwnerIpMarksEndpoint, { method: 'POST', headers: { ...adminHeaders(), 'content-type': 'application/json' }, body: JSON.stringify({ ipAddress }) }); await loadDashboard(); };
const unmarkOwnerIp = async ipAddress => { await fetch(`${adminOwnerIpMarksEndpoint}/${encodeURIComponent(ipAddress)}`, { method: 'DELETE', headers: adminHeaders() }); await loadDashboard(); };
const clearVisitorLogs = async () => { if (!confirm('确定清空最近访问吗？评论和在线人数不会受影响。')) return; await fetch(adminClearVisitsEndpoint, { method: 'DELETE', headers: adminHeaders() }); await loadDashboard(); };
```

- Wire refresh/logout/clear buttons. Logout clears localStorage, resets password, hides content, shows login form.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- test/admin-page.test.mjs`

Expected: PASS.

## Task 3: Visitor Log Location and Retention

**Files:**
- Modify: `worker/test/visitor-logs.test.mjs`
- Modify: `worker/src/index.mjs`
- Create: `worker/migrations/0005_visitor_log_location_and_owner_ip.sql`

- [ ] **Step 1: Write failing Worker tests**

Update `POST /visits records...` to pass a Request with `cf` geolocation:

```js
const request = new Request('https://visitor.example.com/visits', { ... });
Object.defineProperty(request, 'cf', {
  value: { country: 'CN', region: 'Guangdong', city: 'Shenzhen' }
});
```

Assert SQL includes `visitor_location` and bound value equals `CN · Guangdong · Shenzhen`.

Update admin-data expected SQL/test to require `LIMIT 50`, `visitor_location`, `isOwnerVisitor`, and `visitorLocation` in JSON.

Update cleanup test to expect 30-day cutoff instead of 90 days.

Add migration test assertions for `visitor_location TEXT` and `owner_ip_marks` table.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:worker -- worker/test/visitor-logs.test.mjs`

Expected: FAIL on missing visitor_location, old limit, old retention, and missing migration.

- [ ] **Step 3: Implement Worker changes**

In `worker/src/index.mjs`:

- Change `VISITOR_LOG_RETENTION_DAYS` from 90 to 30.
- Add:

```js
function summarizeVisitorLocation(cf = {}) {
  const parts = [cf.country, cf.region, cf.city]
    .map(value => cleanText(value || '', 80))
    .filter(Boolean);
  return parts.length ? parts.join(' · ').slice(0, 160) : '未知地区';
}
```

- In `handleVisit`, compute:

```js
const visitorLocation = summarizeVisitorLocation(request.cf || {});
```

- Insert `visitor_location` into `visitor_logs`.
- In `privateVisitorLog`, return `visitorLocation` and `isOwnerVisitor`.
- In `handleAdminData`, select latest 50 and left join owner marks:

```sql
SELECT
  visitor_logs.id,
  visitor_logs.ip_address,
  visitor_logs.visited_at,
  visitor_logs.visited_page,
  visitor_logs.visitor_device_summary,
  COALESCE(visitor_logs.visitor_location, '未知地区') AS visitor_location,
  owner_ip_marks.ip_address IS NOT NULL AS is_owner_visitor
FROM visitor_logs
LEFT JOIN owner_ip_marks ON owner_ip_marks.ip_address = visitor_logs.ip_address
ORDER BY visitor_logs.visited_at DESC, visitor_logs.id DESC
LIMIT 50
```

- Create migration:

```sql
ALTER TABLE visitor_logs ADD COLUMN visitor_location TEXT DEFAULT '未知地区';

CREATE TABLE IF NOT EXISTS owner_ip_marks (
  ip_address TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);
```

- [ ] **Step 4: Run Worker tests to verify pass**

Run: `npm run test:worker -- worker/test/visitor-logs.test.mjs`

Expected: PASS.

## Task 4: Admin Mutations for Owner IP and Clearing Logs

**Files:**
- Modify: `worker/test/visitor-logs.test.mjs`
- Modify: `worker/src/index.mjs`
- Modify: `test/netlify-worker-proxy.test.mjs`
- Modify: `netlify.toml`

- [ ] **Step 1: Write failing tests**

Add Worker tests:

```js
test('POST /admin-owner-ip-marks marks an Owner Visitor IP only for the owner', async () => { ... });
test('DELETE /admin-owner-ip-marks/:ipAddress removes an Owner Visitor mark only for the owner', async () => { ... });
test('DELETE /admin-visits clears Visitor Logs only for the owner', async () => { ... });
```

Assert unauthorized requests return 401 and valid requests call the expected SQL.

Update Netlify proxy test endpoint list to include `/admin-owner-ip-marks` and `/admin-visits`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:worker -- worker/test/visitor-logs.test.mjs && npm test -- test/netlify-worker-proxy.test.mjs`

Expected: FAIL because endpoints/proxies are absent.

- [ ] **Step 3: Implement endpoints and proxies**

In `worker/src/index.mjs` add:

```js
async function handleMarkOwnerIp(request, env) { ... INSERT INTO owner_ip_marks ... ON CONFLICT DO UPDATE ... }
async function handleUnmarkOwnerIp(request, env, ipAddress) { ... DELETE FROM owner_ip_marks WHERE ip_address = ?1 ... }
async function handleClearVisitorLogs(request, env) { ... DELETE FROM visitor_logs ... }
```

Route:

```js
if (request.method === 'POST' && url.pathname === '/admin-owner-ip-marks') return handleMarkOwnerIp(request, env);
const ownerIpDeleteMatch = url.pathname.match(/^\/admin-owner-ip-marks\/(.+)$/);
if (request.method === 'DELETE' && ownerIpDeleteMatch) return handleUnmarkOwnerIp(request, env, decodeURIComponent(ownerIpDeleteMatch[1]));
if (request.method === 'DELETE' && url.pathname === '/admin-visits') return handleClearVisitorLogs(request, env);
```

In `netlify.toml`, add redirects for `/admin-owner-ip-marks`, `/admin-owner-ip-marks/*`, and `/admin-visits` to the Worker.

- [ ] **Step 4: Run tests to verify pass**

Run: `npm run test:worker -- worker/test/visitor-logs.test.mjs && npm test -- test/netlify-worker-proxy.test.mjs`

Expected: PASS.

## Task 5: Operations Docs and Full Verification

**Files:**
- Modify: `docs/visitor-operations.md`

- [ ] **Step 1: Update docs tests if needed**

If `test/visitor-operations-doc.test.mjs` expects endpoint lists or retention language, add expectations for 30-day retention, local IP marks, admin refresh, and clear logs.

- [ ] **Step 2: Update docs**

In `docs/visitor-operations.md`, describe:

- Admin page remembers password on trusted browsers.
- Use Refresh to reload latest data without browser refresh.
- Use Logout to forget saved admin access.
- Visitor Logs are retained for 30 days and admin display shows latest 50.
- Use Clear Visitor Logs to remove recent visit history without affecting comments or online count.
- Use Mark Local / Unmark Local to label owner IPs.

- [ ] **Step 3: Run full local verification**

Run:

```bash
npm test
npm run test:worker
npm run build
git diff --check
```

Expected: all pass.

- [ ] **Step 4: Do not push automatically**

Stop after local verification and report that changes are ready for one-time deployment. Only run `git push origin main` after explicit user confirmation.

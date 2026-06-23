# Admin Visitor and Comment Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one private owner-facing admin page for Visitor Logs, Online Visitor Count, and Published Comment deletion.

**Architecture:** Keep the Hexo/NexT site static and use the existing Cloudflare Worker/D1 sidecar for private state. Add password-protected Worker admin endpoints, proxy them through Netlify, and create a hidden static `/admin/` page that calls those endpoints after the owner enters the Admin Password.

**Tech Stack:** Hexo/NexT, vanilla JavaScript, Stylus, Cloudflare Worker, Cloudflare D1, Netlify redirects, Node test runner.

---

## Files

- Modify: `worker/src/index.mjs`
  - Add Admin Password verification.
  - Add private visitor log listing.
  - Add private online count summary reuse.
  - Add private comment listing and deletion.
- Modify: `worker/test/visitor-logs.test.mjs`
  - Add admin Visitor Log auth/list tests.
- Modify: `worker/test/article-comments.test.mjs`
  - Add admin comment list/delete auth tests.
- Modify: `test/netlify-worker-proxy.test.mjs`
  - Assert Netlify proxies `/admin-data` and `/admin-comments`.
- Create: `test/admin-page.test.mjs`
  - Assert admin page, script, and private endpoints are wired.
- Create: `source/admin/index.md`
  - Hidden owner-facing admin page.
- Create: `source/js/admin-dashboard.js`
  - Admin Password form, data loading, comment delete UI.
- Modify: `source/_data/styles.styl`
  - Add compact admin page styles.
- Modify: `netlify.toml`
  - Proxy admin endpoints to Worker.
- Modify: `docs/visitor-state-sidecar.md`
  - Document `ADMIN_PASSWORD` secret and basic admin verification.

## Task 1: Worker Admin Authentication and Visitor Data

**Files:**
- Modify: `worker/test/visitor-logs.test.mjs`
- Modify: `worker/src/index.mjs`

- [ ] **Step 1: Write failing tests for admin Visitor data**

Add tests to `worker/test/visitor-logs.test.mjs`:

```js
test('GET /admin-data fails closed without a valid Admin Password', async () => {
  const env = { VISITOR_DB: createVisitDb(), ADMIN_PASSWORD: 'secret-pass' };

  const missing = await worker.fetch(new Request('https://visitor.example.com/admin-data'), env);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Unauthorized' });

  const invalid = await worker.fetch(new Request('https://visitor.example.com/admin-data', {
    headers: { authorization: 'Bearer wrong-pass' }
  }), env);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Unauthorized' });
});

test('GET /admin-data returns recent Visitor Logs and Online Visitor Count for the owner', async () => {
  const db = createVisitDb([
    { count: 2 },
    [{
      id: 7,
      ip_address: '203.0.113.21',
      visited_at: '2026-06-23T12:00:00.000Z',
      visited_page: '/2026/06/05/example-post/',
      visitor_device_summary: 'Chrome on macOS'
    }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-data', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    onlineCount: 2,
    visitorLogs: [{
      id: 7,
      ipAddress: '203.0.113.21',
      visitedAt: '2026-06-23T12:00:00.000Z',
      visitedPage: '/2026/06/05/example-post/',
      visitorDeviceSummary: 'Chrome on macOS'
    }]
  });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test:worker -- worker/test/visitor-logs.test.mjs
```

Expected: fails because `/admin-data` is not implemented and returns `404`.

- [ ] **Step 3: Implement minimal Worker admin Visitor data**

Add helpers and endpoint in `worker/src/index.mjs`:

```js
function isAuthorizedAdmin(request, env) {
  const expected = env?.ADMIN_PASSWORD;
  if (!expected) return false;

  const authorization = request.headers.get('authorization') || '';
  return authorization === `Bearer ${expected}`;
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, { status: 401 });
}

function privateVisitorLog(row) {
  return {
    id: Number(row.id),
    ipAddress: row.ip_address,
    visitedAt: row.visited_at,
    visitedPage: row.visited_page,
    visitorDeviceSummary: row.visitor_device_summary
  };
}

async function readOnlineCount(db, now = new Date()) {
  const activeSince = new Date(now.getTime() - ONLINE_VISITOR_WINDOW_MINUTES * 60 * 1000);
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM visitor_presence
    WHERE last_seen_at >= ?1
  `).bind(activeSince.toISOString()).first();

  return Number(row?.count || 0);
}

async function handleAdminData(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const db = requireVisitorDb(env);
  const onlineCount = await readOnlineCount(db);
  const result = await db.prepare(`
    SELECT id, ip_address, visited_at, visited_page, visitor_device_summary
    FROM visitor_logs
    ORDER BY visited_at DESC, id DESC
    LIMIT 100
  `).all();

  return json({
    onlineCount,
    visitorLogs: (result.results || []).map(privateVisitorLog)
  });
}
```

Update `handleOnlineCount` to call `readOnlineCount(db, now)`.

Route:

```js
if (request.method === 'GET' && url.pathname === '/admin-data') {
  return handleAdminData(request, env);
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm run test:worker -- worker/test/visitor-logs.test.mjs
```

Expected: visitor log tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add worker/src/index.mjs worker/test/visitor-logs.test.mjs
git commit -m "feat: add admin visitor data endpoint"
```

## Task 2: Worker Admin Comment Management

**Files:**
- Modify: `worker/test/article-comments.test.mjs`
- Modify: `worker/src/index.mjs`

- [ ] **Step 1: Write failing tests for admin comment list/delete**

Add tests to `worker/test/article-comments.test.mjs`:

```js
test('GET /admin-comments fails closed without a valid Admin Password', async () => {
  const env = { VISITOR_DB: createCommentDb(), ADMIN_PASSWORD: 'secret-pass' };

  const missing = await worker.fetch(new Request('https://visitor.example.com/admin-comments'), env);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Unauthorized' });

  const invalid = await worker.fetch(new Request('https://visitor.example.com/admin-comments', {
    headers: { authorization: 'Bearer wrong-pass' }
  }), env);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Unauthorized' });
});

test('GET /admin-comments returns private comment details for the owner', async () => {
  const db = createCommentDb([[
    {
      id: 11,
      article_path: '/2026/06/05/example-post/',
      comment_name: '家人',
      comment_email: 'private@example.com',
      comment_body: '我也看到了。',
      created_at: '2026-06-23T12:00:00.000Z'
    }
  ]]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 11,
      articlePath: '/2026/06/05/example-post/',
      name: '家人',
      email: 'private@example.com',
      body: '我也看到了。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }]
  });
});

test('DELETE /admin-comments/:id deletes one comment only for the owner', async () => {
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE'
  }), { VISITOR_DB: createCommentDb(), ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);

  const db = createCommentDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.match(db.calls[0].sql, /DELETE FROM article_comments/i);
  assert.deepEqual(db.calls[0].values, [11]);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
npm run test:worker -- worker/test/article-comments.test.mjs
```

Expected: fails because `/admin-comments` routes are missing.

- [ ] **Step 3: Implement minimal Worker admin comment management**

Add to `worker/src/index.mjs`:

```js
function privateComment(row) {
  return {
    id: Number(row.id),
    articlePath: row.article_path,
    name: row.comment_name,
    email: row.comment_email,
    body: row.comment_body,
    createdAt: row.created_at
  };
}

async function handleAdminListComments(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const db = requireVisitorDb(env);
  const result = await db.prepare(`
    SELECT id, article_path, comment_name, comment_email, comment_body, created_at
    FROM article_comments
    ORDER BY created_at DESC, id DESC
    LIMIT 100
  `).all();

  return json({
    comments: (result.results || []).map(privateComment)
  });
}

async function handleAdminDeleteComment(request, env, id) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return json({ error: 'Invalid comment id' }, { status: 400 });
  }

  const db = requireVisitorDb(env);
  await db.prepare(`
    DELETE FROM article_comments
    WHERE id = ?1
  `).bind(commentId).run();

  return new Response(null, { status: 204 });
}
```

Routes:

```js
if (request.method === 'GET' && url.pathname === '/admin-comments') {
  return handleAdminListComments(request, env);
}

const adminCommentDeleteMatch = url.pathname.match(/^\/admin-comments\/(\d+)$/);
if (request.method === 'DELETE' && adminCommentDeleteMatch) {
  return handleAdminDeleteComment(request, env, adminCommentDeleteMatch[1]);
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
npm run test:worker -- worker/test/article-comments.test.mjs
```

Expected: article comment tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add worker/src/index.mjs worker/test/article-comments.test.mjs
git commit -m "feat: add admin comment management endpoints"
```

## Task 3: Netlify Admin Proxy

**Files:**
- Modify: `test/netlify-worker-proxy.test.mjs`
- Modify: `netlify.toml`

- [ ] **Step 1: Write failing proxy test**

Update endpoint list in `test/netlify-worker-proxy.test.mjs`:

```js
for (const endpoint of ['/comments', '/presence', '/online-count', '/visits', '/admin-data', '/admin-comments']) {
  assert.match(config, new RegExp(`from\\s*=\\s*"${endpoint.replace('/', '\\/')}"`));
  assert.match(config, new RegExp(`to\\s*=\\s*"https:\\/\\/my-life-visitor-state\\.windking566\\.workers\\.dev${endpoint.replace('/', '\\/')}"`));
}

assert.match(config, /from\s*=\s*"\/admin-comments\/:id"/);
assert.match(config, /to\s*=\s*"https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/admin-comments\/:id"/);
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- test/netlify-worker-proxy.test.mjs
```

Expected: fails because admin proxy routes are missing.

- [ ] **Step 3: Add Netlify redirects**

Add to `netlify.toml`:

```toml
[[redirects]]
  from = "/admin-data"
  to = "https://my-life-visitor-state.windking566.workers.dev/admin-data"
  status = 200
  force = true

[[redirects]]
  from = "/admin-comments"
  to = "https://my-life-visitor-state.windking566.workers.dev/admin-comments"
  status = 200
  force = true

[[redirects]]
  from = "/admin-comments/:id"
  to = "https://my-life-visitor-state.windking566.workers.dev/admin-comments/:id"
  status = 200
  force = true
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- test/netlify-worker-proxy.test.mjs
```

Expected: proxy test passes.

- [ ] **Step 5: Commit Task 3**

```bash
git add netlify.toml test/netlify-worker-proxy.test.mjs
git commit -m "feat: proxy admin endpoints"
```

## Task 4: Static Admin Page and Script

**Files:**
- Create: `test/admin-page.test.mjs`
- Create: `source/admin/index.md`
- Create: `source/js/admin-dashboard.js`
- Modify: `source/_data/styles.styl`

- [ ] **Step 1: Write failing admin page test**

Create `test/admin-page.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('admin page renders a private Visitor Admin Page shell', async () => {
  const page = await readFile(new URL('../source/admin/index.md', import.meta.url), 'utf8');

  assert.match(page, /title:\s*后台管理/);
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="admin-dashboard"/);
  assert.match(page, /data-admin-data-endpoint="\/admin-data"/);
  assert.match(page, /data-admin-comments-endpoint="\/admin-comments"/);
  assert.match(page, /\/js\/admin-dashboard\.js/);
});

test('admin dashboard script authenticates, loads owner data, and deletes comments', async () => {
  const script = await readFile(new URL('../source/js/admin-dashboard.js', import.meta.url), 'utf8');

  assert.match(script, /Authorization/);
  assert.match(script, /Bearer/);
  assert.match(script, /admin-data/);
  assert.match(script, /admin-comments/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
});
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- test/admin-page.test.mjs
```

Expected: fails because `source/admin/index.md` and `source/js/admin-dashboard.js` do not exist.

- [ ] **Step 3: Create admin page**

Create `source/admin/index.md`:

```markdown
---
title: 后台管理
date: 2026-06-23 00:00:00
type: admin
comments: false
---

<section
  id="admin-dashboard"
  class="admin-dashboard"
  data-admin-data-endpoint="/admin-data"
  data-admin-comments-endpoint="/admin-comments"
>
  <form class="admin-login" data-admin-login>
    <label>
      管理员密码
      <input type="password" name="password" autocomplete="current-password" required>
    </label>
    <button type="submit">进入后台</button>
  </form>

  <p class="admin-status" data-admin-status></p>

  <div class="admin-content" data-admin-content hidden>
    <section class="admin-section">
      <h2>当前在线</h2>
      <p class="admin-online-count"><span data-admin-online-count>--</span> 人</p>
    </section>

    <section class="admin-section">
      <h2>最近访问</h2>
      <div class="admin-table-wrap">
        <table class="admin-table">
          <thead>
            <tr>
              <th>时间</th>
              <th>IP</th>
              <th>页面</th>
              <th>设备</th>
            </tr>
          </thead>
          <tbody data-admin-visitor-logs></tbody>
        </table>
      </div>
    </section>

    <section class="admin-section">
      <h2>评论管理</h2>
      <div data-admin-comments></div>
    </section>
  </div>
</section>

<script src="/js/admin-dashboard.js"></script>
```

- [ ] **Step 4: Create admin dashboard script**

Create `source/js/admin-dashboard.js` with text-only DOM rendering:

```js
(() => {
  const root = document.getElementById('admin-dashboard');
  if (!root || window.__adminDashboardInitialized) return;
  window.__adminDashboardInitialized = true;

  const loginForm = root.querySelector('[data-admin-login]');
  const status = root.querySelector('[data-admin-status]');
  const content = root.querySelector('[data-admin-content]');
  const onlineCount = root.querySelector('[data-admin-online-count]');
  const visitorLogs = root.querySelector('[data-admin-visitor-logs]');
  const comments = root.querySelector('[data-admin-comments]');
  const adminDataEndpoint = root.dataset.adminDataEndpoint || '/admin-data';
  const adminCommentsEndpoint = root.dataset.adminCommentsEndpoint || '/admin-comments';

  let adminPassword = '';

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  const adminHeaders = () => ({
    Authorization: `Bearer ${adminPassword}`
  });

  const clearNode = node => {
    if (node) node.textContent = '';
  };

  const appendCell = (row, value) => {
    const cell = document.createElement('td');
    cell.textContent = value || '';
    row.append(cell);
  };

  const renderVisitorLogs = logs => {
    clearNode(visitorLogs);
    logs.forEach(log => {
      const row = document.createElement('tr');
      appendCell(row, log.visitedAt ? new Date(log.visitedAt).toLocaleString() : '');
      appendCell(row, log.ipAddress);
      appendCell(row, log.visitedPage);
      appendCell(row, log.visitorDeviceSummary);
      visitorLogs.append(row);
    });
  };

  const renderComments = items => {
    clearNode(comments);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = '暂无评论。';
      comments.append(empty);
      return;
    }

    items.forEach(comment => {
      const item = document.createElement('article');
      item.className = 'admin-comment';

      const meta = document.createElement('p');
      meta.className = 'admin-comment-meta';
      meta.textContent = `#${comment.id} · ${comment.name || '匿名'} · ${comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}`;

      const path = document.createElement('p');
      path.className = 'admin-comment-path';
      path.textContent = comment.articlePath || '';

      const email = document.createElement('p');
      email.className = 'admin-comment-email';
      email.textContent = comment.email || '未留邮箱';

      const body = document.createElement('p');
      body.className = 'admin-comment-body';
      body.textContent = comment.body || '';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '删除';
      button.addEventListener('click', () => {
        deleteComment(comment.id).catch(() => {
          setStatus('删除失败。');
        });
      });

      item.append(meta, path, email, body, button);
      comments.append(item);
    });
  };

  const loadDashboard = async () => {
    setStatus('正在加载...');
    const [adminDataResponse, commentsResponse] = await Promise.all([
      fetch(adminDataEndpoint, { headers: adminHeaders(), cache: 'no-store' }),
      fetch(adminCommentsEndpoint, { headers: adminHeaders(), cache: 'no-store' })
    ]);

    if (!adminDataResponse.ok || !commentsResponse.ok) {
      content.hidden = true;
      setStatus('密码错误或后台暂时无法访问。');
      return;
    }

    const adminData = await adminDataResponse.json();
    const commentsData = await commentsResponse.json();
    onlineCount.textContent = String(adminData.onlineCount ?? '--');
    renderVisitorLogs(Array.isArray(adminData.visitorLogs) ? adminData.visitorLogs : []);
    renderComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
    content.hidden = false;
    setStatus('');
  };

  const deleteComment = async id => {
    const response = await fetch(`${adminCommentsEndpoint}/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });

    if (!response.ok) {
      setStatus('删除失败。');
      return;
    }

    await loadDashboard();
    setStatus('评论已删除。');
  };

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    adminPassword = String(formData.get('password') || '');
    loadDashboard().catch(() => {
      content.hidden = true;
      setStatus('后台暂时无法访问。');
    });
  });
})();
```

- [ ] **Step 5: Add compact admin styles**

Append to `source/_data/styles.styl`:

```stylus
.admin-dashboard {
  margin-top: 2rem;
}

.admin-login,
.admin-section,
.admin-comment {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(255,255,255,.55);
}

.admin-login label {
  display: block;
  margin-bottom: .75rem;
}

.admin-login input {
  display: block;
  width: 100%;
  box-sizing: border-box;
  margin-top: .35rem;
  padding: .55rem .65rem;
  border: 1px solid #bbb;
  border-radius: 4px;
}

.admin-login button,
.admin-comment button {
  border: 0;
  border-radius: 4px;
  padding: .55rem .9rem;
  color: #fff;
  background: #444;
  cursor: pointer;
}

.admin-status {
  min-height: 1.5rem;
  color: #a33;
}

.admin-table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
}

.admin-table th,
.admin-table td {
  border-bottom: 1px solid #ddd;
  padding: .5rem;
  text-align: left;
  vertical-align: top;
}

.admin-comment-meta,
.admin-comment-path,
.admin-comment-email {
  color: #666;
  font-size: .9em;
}

.admin-comment-body {
  white-space: pre-wrap;
}
```

- [ ] **Step 6: Run test to verify GREEN**

Run:

```bash
npm test -- test/admin-page.test.mjs
```

Expected: admin page test passes.

- [ ] **Step 7: Commit Task 4**

```bash
git add test/admin-page.test.mjs source/admin/index.md source/js/admin-dashboard.js source/_data/styles.styl
git commit -m "feat: add private admin dashboard page"
```

## Task 5: Documentation and Final Verification

**Files:**
- Modify: `docs/visitor-state-sidecar.md`

- [ ] **Step 1: Update operations documentation**

Add a short section to `docs/visitor-state-sidecar.md`:

```markdown
## Admin Password

The Visitor Admin Page and Comment Admin management endpoints require an `ADMIN_PASSWORD` Worker secret.

Set it with:

```bash
cd worker
npx wrangler secret put ADMIN_PASSWORD --config wrangler.toml
```

The value is not committed to source control. The admin page sends it as a Bearer token to `/admin-data` and `/admin-comments`.

Verify after deployment:

```bash
curl -H "Authorization: Bearer <password>" https://zw1443.netlify.app/admin-data
curl -H "Authorization: Bearer <password>" https://zw1443.netlify.app/admin-comments
```
```

- [ ] **Step 2: Run full verification**

Run:

```bash
npm test
npm run test:worker
npm run build
git diff --check
```

Expected:

- `npm test`: all tests pass.
- `npm run test:worker`: all Worker tests pass.
- `npm run build`: Hexo generates successfully.
- `git diff --check`: no whitespace errors.

- [ ] **Step 3: Commit docs**

```bash
git add docs/visitor-state-sidecar.md
git commit -m "docs: document admin password operations"
```

- [ ] **Step 4: Deploy Worker secret and Worker**

Run after the user provides or confirms the Admin Password value:

```bash
cd worker
npx wrangler secret put ADMIN_PASSWORD --config wrangler.toml
npx wrangler deploy --config wrangler.toml
```

Expected:

- Secret upload succeeds.
- Worker deploy succeeds.

- [ ] **Step 5: Push static site changes**

```bash
git push origin main
```

Expected: push succeeds and Netlify deploys the admin page.

- [ ] **Step 6: Verify production**

Run:

```bash
curl -I https://zw1443.netlify.app/admin/
curl -H "Authorization: Bearer <password>" https://zw1443.netlify.app/admin-data
curl -H "Authorization: Bearer <password>" https://zw1443.netlify.app/admin-comments
```

Expected:

- `/admin/` returns `200`.
- `/admin-data` returns JSON containing `onlineCount` and `visitorLogs`.
- `/admin-comments` returns JSON containing `comments`.

## Self-Review

- #7 coverage: Visitor Admin Page, Admin Password protection, recent Visitor Logs, Online Visitor Count, and fail-closed auth are covered by Tasks 1, 4, and 5.
- #13 coverage: Comment Admin view, password protection, comment list, comment deletion, public visitor delete prevention, Netlify proxy, and tests are covered by Tasks 2, 3, 4, and 5.
- Scope: This plan intentionally excludes editing comments, moderation queues, CAPTCHA, and full user accounts.
- Placeholder scan: no TBD/TODO placeholders remain.

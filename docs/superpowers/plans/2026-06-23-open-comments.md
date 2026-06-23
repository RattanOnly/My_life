# Open Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an Article Comment Area to every generated article page so Visitors can submit Anonymous Comments without login and see Published Comments immediately.

**Architecture:** Keep the Hexo/NexT site static and extend the existing Cloudflare Worker + D1 sidecar. Article pages render a small comment container and client script; the Worker owns comment validation, persistence, and public reads.

**Tech Stack:** Hexo/NexT Swig overrides, plain browser JavaScript, Cloudflare Worker, D1 migrations, Node test runner.

---

### Task 1: Worker Comment API

**Files:**
- Modify: `worker/src/index.mjs`
- Create: `worker/migrations/0004_article_comments.sql`
- Test: `worker/test/article-comments.test.mjs`

- [ ] **Step 1: Write failing tests**

Cover `POST /comments`, `GET /comments?path=...`, required Comment Name, optional Comment Email, immediate Published Comment response, and the migration schema.

- [ ] **Step 2: Run RED**

Run: `npm run test:worker`

Expected: FAIL because `/comments` is not implemented and `0004_article_comments.sql` is missing.

- [ ] **Step 3: Implement minimal Worker behavior**

Add a D1 `article_comments` table, validate JSON payloads, insert comments, and return public comment fields only. Store optional email privately but never return it from public reads.

- [ ] **Step 4: Run GREEN**

Run: `npm run test:worker`

Expected: PASS.

### Task 2: Article Comment Area UI

**Files:**
- Modify: `source/_data/post-body-end.swig`
- Create: `source/js/article-comments.js`
- Modify: `source/_data/styles.styl`
- Test: `test/article-comments-ui.test.mjs`

- [ ] **Step 1: Write failing tests**

Cover article-only template placement, required name input, optional email input, comment body textarea, script loading, graceful Worker failure handling, and safe text rendering.

- [ ] **Step 2: Run RED**

Run: `npm test`

Expected: FAIL because the comment container and client script are not present.

- [ ] **Step 3: Implement minimal UI**

Render the Article Comment Area from `post-body-end.swig` only when `page.layout === 'post'`. The client script loads comments for `window.location.pathname`, submits `{ path, name, email, body }`, appends the returned Published Comment, and keeps the article readable when Worker calls fail.

- [ ] **Step 4: Run GREEN**

Run: `npm test`

Expected: PASS.

### Task 3: End-to-End Checks and PR

**Files:**
- Modify: `docs/visitor-state-sidecar.md`

- [ ] **Step 1: Document endpoints**

Document `GET /comments?path=...`, `POST /comments`, public fields, and the private optional email field.

- [ ] **Step 2: Verify**

Run:

```bash
npm test
npm run test:worker
npm run build
git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Smoke test locally**

Apply local D1 migrations, start Wrangler, `POST /comments`, `GET /comments?path=...`, and verify the generated article HTML includes the Article Comment Area while `public/index.html` does not.

- [ ] **Step 4: Commit and open PR**

Commit with message `feat: add open article comments`, push `codex/issue-6-open-comments`, open a PR that closes #6, then wait for checks before merge.

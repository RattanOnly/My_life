# Visitor State Sidecar

The Visitor state sidecar is a Cloudflare Worker with a D1 binding. It exists beside the Hexo/NexT static blog so Visitor state can be added without changing the static publishing workflow.

## Local Checks

Install dependencies from the repository root:

```bash
npm install
```

Run the Worker tests:

```bash
npm run test:worker
```

Run the Worker locally:

```bash
npm run worker:dev
```

The smoke-check endpoint is:

```text
GET /health
```

It returns `ok: true` only when the Worker can reach the `VISITOR_DB` D1 binding.

Apply D1 migrations locally before testing endpoints that write state:

```bash
npm exec -- wrangler --config worker/wrangler.toml d1 migrations apply my-life-visitor-state --local
```

## D1 Binding

The Worker expects a D1 binding named `VISITOR_DB`.

`worker/wrangler.toml` includes a placeholder `database_id`. Before deploying, create or choose a Cloudflare D1 database and replace the placeholder locally or through deployment configuration.

Do not commit real secrets. Future slices will add secrets such as the Admin Password through environment or platform configuration.

## Migrations

D1 migrations live under `worker/migrations/`. The first migration establishes a metadata table so the sidecar has a concrete migration path before Visitor Logs and presence tables are added.

The Visitor Log migration creates a private `visitor_logs` table with:

- `ip_address`
- `visited_at`
- `visited_page`
- `visitor_device_summary`

## Visitor Logs

The public write endpoint is:

```text
POST /visits
```

Request body:

```json
{
  "path": "/2026/06/22/example-post/"
}
```

The Worker records the Visitor IP from Cloudflare's `CF-Connecting-IP` header, stores the current access time, normalizes the Visited Page to path plus query string, and stores a short Visitor Device Summary such as `Safari on iOS`.

Visitor Logs are private. Public requests can write a Visitor Log through `POST /visits`, but there is no public endpoint that returns Visitor Logs.

## Visitor Log Retention

Visitor Log Retention is 90 days. `worker/wrangler.toml` configures a daily scheduled Worker trigger that deletes `visitor_logs` rows with `visited_at` older than the retention cutoff.

This keeps regular visits to one D1 write each. Retention cleanup runs separately so page visits do not also perform cleanup queries.

## Online Visitor Count

The public heartbeat endpoint is:

```text
POST /presence
```

It updates the Visitor's current presence without writing to permanent Visitor Logs.

The public count endpoint is:

```text
GET /online-count
```

Response body:

```json
{
  "count": 1
}
```

The count is calculated from recent presence rows and returns only the Online Visitor Count. It does not expose IP addresses, Visitor Logs, or individual Visitor records.

The static blog footer contains a Footer Online Count container and loads `/js/visitor-online.js`. The client sends a conservative heartbeat every 60 seconds and keeps the page readable if the sidecar is unavailable.

## Article Comments

Article pages include an Article Comment Area at the bottom of the post body and load `/js/article-comments.js`. Homepage, archive, tag, category, and general pages do not render this container.

The public read endpoint is:

```text
GET /comments?path=/2026/06/05/example-post/
```

Response body:

```json
{
  "comments": [
    {
      "id": 1,
      "name": "Visitor",
      "body": "A Published Comment.",
      "createdAt": "2026-06-23T12:00:00.000Z"
    }
  ]
}
```

The public write endpoint is:

```text
POST /comments
```

Request body:

```json
{
  "path": "/2026/06/05/example-post/",
  "name": "Visitor",
  "email": "visitor@example.com",
  "body": "A Published Comment."
}
```

`name` and `body` are required. `email` is optional and stored only as a private owner-facing contact field for future admin views. Public comment reads never return Comment Email.

Anonymous Comments become Published Comments immediately. The first version intentionally does not add external account login, GitHub-based commenting, CAPTCHA, Turnstile, or manual moderation. If the sidecar is unavailable, the article remains readable and the comment area shows a visible failure state.

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

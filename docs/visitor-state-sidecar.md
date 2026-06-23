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

## D1 Binding

The Worker expects a D1 binding named `VISITOR_DB`.

`worker/wrangler.toml` includes a placeholder `database_id`. Before deploying, create or choose a Cloudflare D1 database and replace the placeholder locally or through deployment configuration.

Do not commit real secrets. Future slices will add secrets such as the Admin Password through environment or platform configuration.

## Migrations

D1 migrations live under `worker/migrations/`. The first migration establishes a metadata table so the sidecar has a concrete migration path before Visitor Logs and presence tables are added.

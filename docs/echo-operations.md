# Echo Operations Guide

Echo is the public AI conversation page for the blog. The page is backed by the Cloudflare Worker sidecar, so provider API keys stay on the backend and are not exposed to browsers.

## Cloudflare Resources

Echo uses the existing Cloudflare-only hosting shape:

- D1 binding: `VISITOR_DB`
- Cloudflare Vectorize binding: `ECHO_VECTORIZE`
- Vectorize index: `my-life-echo-large`
- Vector dimension: `3072`
- Embedding model: `text-embedding-3-large`

Create the first Vectorize index with:

```bash
wrangler vectorize create my-life-echo-large --dimensions=3072 --metric=cosine
```

Keep `worker/wrangler.toml` aligned with the production Cloudflare resources before deploying the Worker sidecar.

## Worker Secrets And Environment Variables

The Worker reads OpenAI-compatible chat and embedding provider settings from secrets or environment variables:

- `ECHO_CHAT_API_KEY`
- `ECHO_CHAT_BASE_URL`
- `ECHO_CHAT_MODEL`
- `ECHO_EMBEDDING_API_KEY`
- `ECHO_EMBEDDING_BASE_URL`
- `ECHO_EMBEDDING_MODEL`

Do not commit secret values. Store real provider keys in Cloudflare Worker secrets or production deployment configuration only.

## Cloudflare Pages Build Variables

Cloudflare Pages builds can refresh the remote Vectorize index when these variables are present:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `ECHO_VECTORIZE_INDEX`

`CLOUDFLARE_API_TOKEN` must be scoped narrowly enough for the build job, but it must be able to update the Cloudflare Vectorize index. Local builds and Pages builds without these variables skip the remote Vectorize rebuild.

Production-scoped environment variables are safer. Preview builds that receive the same variables can mutate the shared `my-life-echo-large` index, so avoid exposing the production indexing token to preview contexts unless that is intentional.

## Index Refresh

Published posts and `source/_data/echo-tone-summary.md` are the source material for Echo retrieval. Drafts and unpublished content should not be indexed.

Refresh the Echo retrieval index with:

```bash
npm run echo:index
```

Verify extraction without sending embeddings or updating Cloudflare Vectorize with:

```bash
ECHO_INDEX_DRY_RUN=1 npm run echo:index
```

## Privacy Boundaries

Echo 不会保存访客的问题。

Echo 不会保存 AI 回复。

The backend records only operational metadata for abuse and failure monitoring:

- request status
- request time
- token estimate
- failure state
- retrieval count

Conversation content must not be written to D1, logs, analytics, or browser storage.

## Owner Controls

The admin page can pause or resume Echo. When Echo is paused, `/echo/` remains visible, but visitors see a warm unavailable message instead of sending a chat request to the provider.

Use the admin controls for temporary provider outages, unexpected cost spikes, abuse monitoring, or maintenance windows.

## Known Limitation And Follow-Up

Obsolete vectors are not currently reconciled. Future cleanup should use a safe manifest-based process that identifies stale vector IDs after a successful upsert. Never delete all vectors before a successful replacement upsert has completed.

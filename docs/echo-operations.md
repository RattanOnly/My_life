# Echo Operations Guide

Echo is the public AI conversation page for the blog. The page is backed by the Cloudflare Worker sidecar, so provider API keys stay on the backend and are not exposed to browsers.

## Cloudflare Resources

Echo uses the existing Cloudflare-only hosting shape:

- D1 binding: `VISITOR_DB`
- Workers AI binding: `AI`
- Cloudflare Vectorize binding: `ECHO_VECTORIZE`
- Vectorize index: `my-life-echo-bge-m3`
- Vector dimension: `1024`
- Embedding model: `@cf/baai/bge-m3`

Create the first Vectorize index with:

```bash
wrangler vectorize create my-life-echo-bge-m3 --dimensions=1024 --metric=cosine
```

Keep `worker/wrangler.toml` aligned with the production Cloudflare resources before deploying the Worker sidecar. Both indexing and visitor retrieval use the same Workers AI model inside Cloudflare. If the embedding model changes, create a new Vectorize index whose dimensions match the new model before changing the production binding.

## Worker Secrets And Environment Variables

The Worker runtime needs chat, indexing, and admin authentication secrets or environment variables:

- `ECHO_CHAT_API_KEY`
- `ECHO_CHAT_BASE_URL`
- `ECHO_CHAT_MODEL`
- `ECHO_CHAT_REASONING_EFFORT`
- `ECHO_INDEX_TOKEN`
- `ADMIN_PASSWORD`

`ECHO_CHAT_REASONING_EFFORT` is optional and only accepts `low`, `medium`, or `high`. Use `medium` for the production Echo companion because it balances reply quality, latency, and cost for warm conversational responses.

Do not commit secret values. Store real provider keys and `ADMIN_PASSWORD` in Cloudflare Worker secrets or production deployment configuration only.

## Cloudflare Pages Build Variables

Cloudflare Pages builds refresh the remote Vectorize index after the static build. The build sends published document fragments to a protected Worker endpoint; the Worker performs embedding and Vectorize writes inside Cloudflare. Pages needs only:

- `ECHO_INDEX_URL`, set to `https://lovezvv.com/echo-index`
- `ECHO_INDEX_TOKEN`, matching the Worker secret

The endpoint is not a public browser API. It requires the bearer token and accepts bounded batches only. Index refresh has three distinct outcomes:

- Dry run (`ECHO_INDEX_DRY_RUN=1`) extracts documents only, with no Worker or Vectorize calls.
- Builds missing both endpoint variables skip the remote refresh.
- Builds with only one endpoint variable, invalid authentication, or a failed embedding/upsert fail the build instead of silently publishing a stale index.

Production-scoped environment variables are safer. Preview builds that receive the same variables can mutate the shared `my-life-echo-bge-m3` index, so avoid exposing the production indexing token to preview contexts unless that is intentional.

## Index Refresh

Published posts, `source/_data/echo-owner-profile.md`, and `source/_data/echo-tone-summary.md` are the source material for Echo retrieval. Drafts and unpublished content should not be indexed.

`source/_data/echo-owner-profile.md` should hold stable owner-approved facts such as the site owner's public name, nickname, and relationship to Echo. It should not become a manually maintained biography for every new mood or article. New published posts enter the retrieval index during build so Echo can pick up newer writing without editing the stable profile every time.

The indexer uses the Node global `fetch`, `FormData`, and `Blob`. Use Node 18 or newer; Node 20 or Node 22 is preferred on Cloudflare Pages.

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

Protect the owner controls with the Worker `ADMIN_PASSWORD` secret. The admin UI is backed by `/admin-echo` for status changes and `/admin-echo-usage` for operational usage data.

The admin page can pause or resume Echo. When Echo is paused, `/echo/` remains visible, but visitors see a warm unavailable message instead of sending a chat request to the provider. `/echo-chat` should return the paused state without calling the chat or embedding provider.

Minimum verification after deployment: log in to the admin UI, confirm pause and resume both work, pause Echo, then verify visitors on `/echo/` see the unavailable state and `/echo-chat` does not call the provider.

Use the admin controls for temporary provider outages, unexpected cost spikes, abuse monitoring, or maintenance windows.

## Known Limitation And Follow-Up

Obsolete vectors are not currently reconciled. Future cleanup should use a safe manifest-based process that identifies stale vector IDs after a successful upsert. Never delete all vectors before a successful replacement upsert has completed.

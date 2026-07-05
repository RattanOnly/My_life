# Echo Operations Guide

Echo is the public AI conversation page for the blog. The page is backed by the Cloudflare Worker sidecar, so provider API keys stay on the backend and are not exposed to browsers.

## Cloudflare Resources

Echo uses the existing Cloudflare-only hosting shape:

- D1 binding: `VISITOR_DB`
- Cloudflare Vectorize binding: `ECHO_VECTORIZE`
- Vectorize index: `my-life-echo-small`
- Vector dimension: `1536`
- Embedding model: `text-embedding-3-small`

Create the first Vectorize index with:

```bash
wrangler vectorize create my-life-echo-small --dimensions=1536 --metric=cosine
```

Keep `worker/wrangler.toml` aligned with the production Cloudflare resources before deploying the Worker sidecar. Cloudflare Vectorize currently rejects 3072-dimensional indexes on this account, so the first deployed Echo index uses the 1536-dimensional `text-embedding-3-small` model.

The default embedding setup is `text-embedding-3-small` with `ECHO_EMBEDDING_DIMENSIONS=1536` for the Pages/Node indexing job. If you switch models, changing environment variables is not enough: keep the Worker embedding model compatible with the Cloudflare Vectorize index, and match or recreate the Vectorize index dimensions so they match the vector length returned by the provider. The indexing job uses `ECHO_EMBEDDING_DIMENSIONS` to validate provider output before upsert and fails before Vectorize upsert when the dimensions do not match.

## Worker Secrets And Environment Variables

The Worker runtime needs chat, embedding, and admin authentication secrets or environment variables:

- `ECHO_CHAT_API_KEY`
- `ECHO_CHAT_BASE_URL`
- `ECHO_CHAT_MODEL`
- `ECHO_EMBEDDING_API_KEY`
- `ECHO_EMBEDDING_BASE_URL`
- `ECHO_EMBEDDING_MODEL`
- `ADMIN_PASSWORD`

Do not commit secret values. Store real provider keys and `ADMIN_PASSWORD` in Cloudflare Worker secrets or production deployment configuration only.

## Cloudflare Pages Build Variables

Cloudflare Pages builds can refresh the remote Vectorize index after the static build. That indexing job is separate from the Worker runtime and needs both Cloudflare write access and the embedding provider configuration:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `ECHO_VECTORIZE_INDEX`
- `ECHO_EMBEDDING_API_KEY`
- `ECHO_EMBEDDING_BASE_URL`
- `ECHO_EMBEDDING_MODEL`
- `ECHO_EMBEDDING_DIMENSIONS`

`ECHO_EMBEDDING_DIMENSIONS` should stay `1536` for the default `text-embedding-3-small` setup. Setting only the Cloudflare account, token, and index name is not enough for remote indexing because the Pages job must also call the embedding provider before it can upsert vectors.

`CLOUDFLARE_API_TOKEN` must be scoped narrowly enough for the build job, but it must be able to update the Cloudflare Vectorize index. Index refresh has three distinct outcomes:

- Dry run (`ECHO_INDEX_DRY_RUN=1`) extracts documents only, with no embedding provider calls and no Vectorize calls.
- Builds missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN skip the remote Vectorize rebuild.
- Builds with Cloudflare account/token present but incomplete embedding provider environment, or provider dimensions that do not match `ECHO_EMBEDDING_DIMENSIONS`, fail before Vectorize upsert.

Production-scoped environment variables are safer. Preview builds that receive the same variables can mutate the shared `my-life-echo-small` index, so avoid exposing the production indexing token to preview contexts unless that is intentional.

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

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

Production currently sets `ECHO_CHAT_MODEL=gpt-5.6-sol` and `ECHO_CHAT_REASONING_EFFORT=medium` as encrypted Worker secrets. If the model override is missing, the reasoning value is missing or invalid, or the configured model returns a retryable provider response error, the Worker falls back to `gpt-5.5` with `medium` reasoning. Authentication, rate-limit, and network failures are not retried with another model because changing models cannot resolve them.

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

## Hidden Letter

藏信完全由 Echo 在原有聊天里处理：模型收到站长交付的问题、参考答案、信件和对话叮嘱，自行按语义判断前两题，逐题自然回应。没有单独的答题页面、信封、拆信按钮或校验接口。

生产 Worker 使用加密 secret `ECHO_LETTER_DATA`，格式保持为包含两个 `questions`、完整 `letter` 和 `postscript` 的 JSON。每个问题有 `prompt` 和 `answerGroups`；每组的第一个短语组成给模型的参考答案，其余候选短语不再用于程序匹配。通过标准输入运行 `wrangler secret put ECHO_LETTER_DATA --config worker/wrangler.toml` 可以更新内容。

真实答案和信件不应提交到公开仓库、静态构建产物或 Echo 检索索引。它们只在服务端加入聊天模型的系统上下文，不直接作为接口字段返回浏览器。模型同时知道参考答案和信件；这里采用对话约定，不作为严格的身份验证。

前两个回忆未对上时，Echo 应温柔地让来访者重试，不提前说答案或读信；前两题通过后问“你为什么喜欢他？”，该题不设标准答案，可以自由回答或表示想亲口告诉赵威。随后 Echo 在聊天回复里完整转达原信，背面留言留到来访者问起时再说。

第三题与其他聊天内容一样，会作为当前会话发送给聊天模型，不写入 D1、日志或浏览器持久化存储。页面只在内存里保留最近 24 条消息，发送时最多携带这 24 条，后端每条最多接收 3000 字；刷新或离开 Echo 后不恢复旧对话。聊天成功响应带 `Cache-Control: no-store`。用量记录仍只有状态和 token 等元数据。

上线检查应覆盖：普通聊天不主动提信、自报收信人后自然问起回忆、答错重试、第二题语义近似及缺少原因、第三题自由回答和跳过、完整读信、之后追问背面留言，以及手机聊天输入框始终可用。

## Known Limitation And Follow-Up

Obsolete vectors are not currently reconciled. Future cleanup should use a safe manifest-based process that identifies stale vector IDs after a successful upsert. Never delete all vectors before a successful replacement upsert has completed.

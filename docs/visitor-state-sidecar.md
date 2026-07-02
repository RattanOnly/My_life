# Visitor State Sidecar

The Visitor state sidecar is a Cloudflare Worker with a D1 binding. It exists beside the Hexo/NexT static blog so Visitor Logs, Online Visitor Count, Published Comments, and owner-facing admin data can be added without turning the blog into a dynamic application.

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

## Deployment

Cloudflare Pages hosts the static blog. Production should be built from the GitHub `main` branch with:

- build command: `npm run build`
- build output directory: `public`

Production deploys are triggered from the GitHub `main` branch through the connected Cloudflare Pages project. Manual Pages uploads are reserved for deployment troubleshooting, not the normal publishing path.

The sidecar deploys separately from the Hexo static site:

```bash
npx wrangler deploy --config worker/wrangler.toml
```

or from the Worker directory:

```bash
cd worker
npx wrangler deploy --config wrangler.toml
```

Cloudflare Worker Routes own same-origin Visitor state API paths on `lovezvv.com` and `www.lovezvv.com`. The route list lives in `worker/wrangler.toml`.

## D1 Binding

The Worker expects a D1 binding named `VISITOR_DB`.

`worker/wrangler.toml` binds:

- binding: `VISITOR_DB`
- database name: `my-life-visitor-state`
- migrations directory: `worker/migrations`

Create or choose a D1 database in Cloudflare, then keep the `database_id` in `worker/wrangler.toml` aligned with that database.

Apply migrations to the production D1 database:

```bash
npx wrangler d1 migrations apply my-life-visitor-state --remote --config worker/wrangler.toml
```

Do not commit real secrets. Secrets such as the Admin Password must be supplied through Cloudflare Worker secrets or equivalent deployment configuration.

## Migrations

D1 migrations live under `worker/migrations/`. The first migration establishes a metadata table so the sidecar has a concrete migration path before Visitor Logs and presence tables are added.

The Visitor Log migration creates a private `visitor_logs` table with:

- `ip_address`
- `visited_at`
- `visited_page`
- `visitor_device_summary`
- `visitor_location`

The owner IP mark migration creates `owner_ip_marks` so the owner can label known local IP addresses as Owner Visitor traffic in the Visitor Admin Page.

The presence migration creates `visitor_presence` for the Online Visitor Count.

The comment migration creates `article_comments` for Published Comments.

## Static Blog Configuration

Public pages and owner admin pages call same-origin API paths. Cloudflare routes these paths to the Worker before they reach the static Pages site:

- `POST /visits`
- `POST /presence`
- `GET /online-count`
- `GET /comments?path=/2026/06/05/example-post/`
- `POST /comments`
- `GET /admin-data`
- `GET /admin-comments`
- `DELETE /admin-comments/:id`
- `GET /admin-owner-ip-marks`
- `POST /admin-owner-ip-marks`
- `DELETE /admin-owner-ip-marks/:ipAddress`
- `DELETE /admin-visits`

The static site pieces are:

- `source/_data/footer.swig`: Footer Online Count container and public scripts.
- `source/_data/post-body-end.swig`: Article Comment Area on post pages only.
- `source/js/visitor-online.js`: visit and heartbeat client.
- `source/js/article-comments.js`: public Open Commenting client.
- `source/admin/index.md`: private owner-facing `/admin/` page.
- `source/js/admin-dashboard.js`: Visitor Admin Page and Comment Admin client.

Run the normal static build before publishing:

```bash
npm run build
```

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

The Worker records the Visitor IP from Cloudflare's `CF-Connecting-IP` header, stores the current access time, normalizes the Visited Page to path plus query string, stores a short Visitor Device Summary such as `Safari on iOS`, and stores a coarse Visitor Location from Cloudflare request geolocation when available. Common country codes are rendered as readable country names.

Visitor Logs are private. Public requests can write a Visitor Log through `POST /visits`, but there is no public endpoint that returns Visitor Logs.

## Visitor Log Retention

Visitor Log Retention is 30 days. `worker/wrangler.toml` configures a daily scheduled Worker trigger that deletes `visitor_logs` rows with `visited_at` older than the retention cutoff.

This keeps regular visits to one D1 write each. Retention cleanup runs separately so page visits do not also perform cleanup queries.

## Online Visitor Count

The public heartbeat endpoint is:

```text
POST /presence
```

It updates the Visitor's current presence without writing to permanent Visitor Logs. The browser sends an anonymous browser Visitor ID stored in local storage. The Worker hashes that ID before writing `visitor_presence`, so a single browser stays one online visitor even if the network IP changes during the session.

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
  "body": "A Published Comment."
}
```

`name` and `body` are required. Public comment reads expose only Published Comment id, Comment Name, comment body, and created time.

Anonymous Comments become Published Comments immediately. The first version intentionally does not add external account login, CAPTCHA, Turnstile, or manual moderation. If the sidecar is unavailable, the article remains readable and the comment area shows a visible failure state.

The Open Commenting service is implemented by the Worker and D1. There is no third-party comment provider to configure. The required endpoints are `/comments` for public list/create and `/admin-comments` for owner-facing list/delete.

## Admin Password

The Visitor Admin Page and Comment Admin management endpoints require an `ADMIN_PASSWORD` Worker secret.

Set it with:

```bash
cd worker
npx wrangler secret put ADMIN_PASSWORD --config wrangler.toml
```

The value is not committed to source control. The admin page sends it as a Bearer token to `/admin-data`, `/admin-comments`, `/admin-owner-ip-marks`, and `/admin-visits`.

Verify after deployment:

```bash
curl -H "Authorization: Bearer <password>" https://lovezvv.com/admin-data
curl -H "Authorization: Bearer <password>" https://lovezvv.com/admin-comments
```

## Visitor Admin Page

The Visitor Admin Page is available at:

```text
https://lovezvv.com/admin/
```

It is not linked from the public navigation. The page shows no Visitor Logs or comments until the correct Admin Password is submitted. On a trusted browser, successful login saves the Admin Password in local storage so the Visitor Admin Page can reopen without re-entering it.

After successful authentication it shows:

- current Online Visitor Count
- latest 50 Visitor Logs with Visitor or local owner label, coarse Visitor Location, access time, Visited Page, and Visitor Device Summary
- recent Published Comments with article path, Comment Name, body, created time, and delete action

Refresh reloads the latest admin data without a browser refresh. Logout forgets the saved Admin Password and returns to the login form. Mark Local labels an owner IP as local; the same row can be unmarked later. Clear Visitor Logs removes Visitor Logs without deleting comments or Online Visitor Count state.

Failed, missing, or invalid authentication returns `401` from the Worker and the page keeps private data hidden.

## Verification Checklist

Run local verification:

```bash
npm test
npm run test:worker
npm run build
git diff --check
```

Verify the deployed same-origin Worker Routes:

```bash
curl https://lovezvv.com/online-count
curl -H "Authorization: Bearer <password>" https://lovezvv.com/admin-data
curl -H "Authorization: Bearer <password>" https://lovezvv.com/admin-comments
curl -X POST -H "Authorization: Bearer <password>" -H "content-type: application/json" -d '{"ipAddress":"203.0.113.21"}' https://lovezvv.com/admin-owner-ip-marks
curl -X DELETE -H "Authorization: Bearer <password>" https://lovezvv.com/admin-visits
```

Browser checks:

- Open an article and confirm the Article Comment Area appears at the bottom.
- Submit a test Anonymous Comment with Comment Name and body.
- Confirm the Footer Online Count changes from `--` to a number.
- Open `/admin/`, enter the Admin Password, and confirm Visitor Logs and comments load.
- Use Refresh to reload Visitor Logs without refreshing the browser tab.
- Mark one disposable IP as local, confirm it displays as local, then unmark it.
- Delete only disposable test comments.

## Troubleshooting

If the Footer Online Count stays as `--`:

- Check that `GET /online-count` returns JSON.
- Check the browser console for failed requests from `/js/visitor-online.js`.
- Confirm `worker/wrangler.toml` routes `lovezvv.com/online-count` and `www.lovezvv.com/online-count` to the Worker.

If comments show `评论暂时无法加载。`:

- Check `GET /comments?path=<article-path>` returns JSON.
- Check the Worker deployment includes the `article_comments` migration.
- If the issue only happens after clicking through the site, verify `/js/article-comments.js` listens for `pjax:success`.

If `/admin/` opens but data does not load:

- Confirm the `ADMIN_PASSWORD` Worker secret exists.
- Confirm the page sends `Authorization: Bearer <password>` to `/admin-data`, `/admin-comments`, `/admin-owner-ip-marks`, and `/admin-visits`.
- Check the same requests directly with `curl`.
- Treat `401` as an auth failure and do not expose logs or comments.

If Worker deployment fails:

- Run `npx wrangler whoami` to confirm Cloudflare authentication.
- Confirm `worker/wrangler.toml` has the correct D1 `database_id`.
- Re-run remote migrations before testing endpoints that query new tables.

## Privacy Boundaries

Visitor Logs are private owner-facing data. They include IP address, access time, Visited Page, coarse Visitor Location, and Visitor Device Summary, and are shown only after Admin Password authentication.

Visitor Log Retention is 30 days. The scheduled Worker cleanup deletes older Visitor Logs. The Visitor Admin Page displays the latest 50 Visitor Logs.

The public Footer Online Count exposes only an aggregate Online Visitor Count. It does not expose IP addresses, Visitor Logs, visitor identity, or device details.

Public comment reads expose Published Comment id, Comment Name, comment body, and created time.

Do not share screenshots or exports of the admin page publicly.

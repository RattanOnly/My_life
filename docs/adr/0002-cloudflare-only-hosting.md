# Use Cloudflare-only Hosting for the Blog

The blog will move from Netlify-hosted static pages to Cloudflare Pages as the primary static hosting platform. The first migration phase moves the whole generated site to Cloudflare Pages without changing existing image or music paths; Cloudflare R2 is prepared for a later asset migration. The existing Cloudflare Worker plus D1 sidecar will continue to own Visitor Logs, Online Visitor Count, Published Comments, and owner-facing admin APIs through same-domain Worker Routes.

**Considered Options**

- Keep Netlify as the primary host: rejected because the credit-based bandwidth, request, and deploy model creates ongoing limits for a personal media-heavy blog.
- Move static assets to R2 at the same time as the hosting migration: deferred because the owner wants the site host migration completed first, with image and music migration handled afterward.
- Keep Netlify as a fallback deployment configuration: rejected because the owner wants a clean Cloudflare-only repository without redundant deployment files.
- Move to a full dynamic application: rejected because the Hexo static site plus Cloudflare state sidecar remains simpler for this blog.

**Consequences**

Netlify-specific configuration and tests should be removed rather than preserved as active project files. Cloudflare Pages redirects, Worker Routes, and Cloudflare deployment documentation become the source of truth for production. R2 asset links should be introduced only when the later asset migration is implemented.

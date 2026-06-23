# Use Cloudflare Worker and D1 for Visitor State

The blog remains a Hexo/NexT static site, but Visitor Logs and Online Visitor Count require server-side state. We will use Cloudflare Worker and D1 as a sidecar backend so the static publishing flow can stay intact while access logging, online presence, and the private Visitor Admin Page have a small persistent service.

**Considered Options**

- Keep the site purely static: rejected because it cannot reliably store Visitor Logs or calculate Online Visitor Count.
- Move the blog to a full dynamic application: rejected because it is too heavy for a personal blog with low traffic.
- Use Vercel, Supabase, or Firebase: viable, but heavier than needed for a small sidecar backend.

**Consequences**

The Worker and D1 database become a separate deployment surface from the Hexo site. The implementation should stay small and should preserve the current static blog workflow.

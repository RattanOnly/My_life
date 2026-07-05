# Use Cloudflare Vectorize for Echo Retrieval

The Echo Page will use Cloudflare Vectorize as the first-version retrieval index for the AI Visitor Conversation Assistant. We choose Vectorize over a static article knowledge package because the owner values visitor response quality and future growth more than keeping the first implementation minimal, while the public blog articles, Owner-Approved Public Profile, and Owner-Approved Tone Summary remain the source of truth.

The first implementation will use `text-embedding-3-small` as the Echo Embedding Model. The owner originally preferred testing `text-embedding-3-large`, but Cloudflare Vectorize rejected a 3072-dimensional index on this account, so the deployable first version uses a 1536-dimensional index.

**Considered Options**

- Use only a static article knowledge package: simpler, but weaker for specific questions and likely to be replaced as the writing archive grows.
- Use an external vector database: viable, but adds another provider outside the existing Cloudflare-only hosting direction.
- Use Cloudflare Vectorize with `text-embedding-3-small`: accepted because it fits the current Cloudflare Pages plus Worker architecture, can be rebuilt from public articles instead of becoming a second hand-maintained content source, and fits the current Vectorize dimension limit.
- Use Cloudflare Vectorize with `text-embedding-3-large`: preferred for retrieval headroom, but rejected for the first deployable version because its 3072-dimensional vectors cannot be used with the current Cloudflare Vectorize index limit on this account.

**Consequences**

The Worker sidecar will need an ingestion path that turns published articles into retrievable writing fragments, generates embeddings with OpenAI-compatible embedding API calls, and indexes them in Vectorize. Published articles should enter the Echo retrieval index by default so the owner does not have to maintain a separate approval workflow for each post. Article edits should refresh the indexed fragments, deleted or unpublished articles should be removed from the index, and drafts should never enter the index. The index should be treated as rebuildable derived data, not an author-edited knowledge base.

Because `text-embedding-3-small` returns 1536-dimensional vectors, the Vectorize index for this trial should be created with dimension `1536`. Switching later to a higher-dimensional model would require creating or rebuilding a separate compatible index rather than changing the existing index in place.

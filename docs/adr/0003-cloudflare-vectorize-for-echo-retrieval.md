# Use Cloudflare Vectorize for Echo Retrieval

The Echo Page will use Cloudflare Vectorize as the first-version retrieval index for the AI Visitor Conversation Assistant. We choose Vectorize over a static article knowledge package because the owner values visitor response quality and future growth more than keeping the first implementation minimal, while the public blog articles and Owner-Approved Tone Summary remain the source of truth.

The first implementation will try `text-embedding-3-large` as the Echo Embedding Model. The owner prefers testing retrieval quality first while traffic is low and embedding cost is still negligible for the current blog size.

**Considered Options**

- Use only a static article knowledge package: simpler, but weaker for specific questions and likely to be replaced as the writing archive grows.
- Use an external vector database: viable, but adds another provider outside the existing Cloudflare-only hosting direction.
- Use Cloudflare Vectorize with `text-embedding-3-small`: cheaper and lighter, but rejected for the first trial because the owner wants to test the higher-quality option before optimizing cost.
- Use Cloudflare Vectorize with `text-embedding-3-large`: accepted because it fits the current Cloudflare Pages plus Worker architecture, can be rebuilt from public articles instead of becoming a second hand-maintained content source, and gives the first version more retrieval headroom.

**Consequences**

The Worker sidecar will need an ingestion path that turns published articles into retrievable writing fragments, generates embeddings with OpenAI-compatible embedding API calls, and indexes them in Vectorize. Published articles should enter the Echo retrieval index by default so the owner does not have to maintain a separate approval workflow for each post. Article edits should refresh the indexed fragments, deleted or unpublished articles should be removed from the index, and drafts should never enter the index. The index should be treated as rebuildable derived data, not an author-edited knowledge base.

Because `text-embedding-3-large` returns 3072-dimensional vectors, the Vectorize index for this trial should be created with dimension `3072`. Switching later to `text-embedding-3-small` would require creating or rebuilding a separate 1536-dimensional index rather than changing the existing index in place.

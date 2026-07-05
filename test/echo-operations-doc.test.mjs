import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Echo operations documentation covers Cloudflare setup, indexing, privacy, and owner controls', async () => {
  const doc = await readFile(new URL('../docs/echo-operations.md', import.meta.url), 'utf8');

  for (const requiredText of [
    'Cloudflare Vectorize',
    'my-life-echo-small',
    '1536',
    'ECHO_CHAT_API_KEY',
    'ECHO_CHAT_REASONING_EFFORT',
    'ECHO_EMBEDDING_API_KEY',
    'ECHO_EMBEDDING_DIMENSIONS',
    'text-embedding-3-small',
    'Cloudflare Vectorize currently rejects 3072-dimensional indexes',
    'wrangler vectorize create my-life-echo-small --dimensions=1536 --metric=cosine',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'ECHO_VECTORIZE_INDEX',
    'extracts documents only',
    'missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN',
    'fails before Vectorize upsert',
    'ECHO_INDEX_DRY_RUN=1 npm run echo:index',
    'source/_data/echo-owner-profile.md',
    'source/_data/echo-tone-summary.md',
    'ADMIN_PASSWORD',
    '/admin-echo',
    '/admin-echo-usage',
    'pause',
    'resume',
    'Node 18',
    'npm run echo:index',
    '不会保存访客的问题',
    '不会保存 AI 回复'
  ]) {
    assert.match(doc, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  const workerRuntimeSection = doc.match(
    /## Worker Secrets And Environment Variables[\s\S]*?## Cloudflare Pages Build Variables/
  )?.[0] ?? '';
  assert.doesNotMatch(workerRuntimeSection, /ECHO_EMBEDDING_DIMENSIONS/);

  assert.doesNotMatch(doc, /sk-[A-Za-z0-9_-]{8,}/);
});

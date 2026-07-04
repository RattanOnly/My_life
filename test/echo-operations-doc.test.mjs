import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Echo operations documentation covers Cloudflare setup, indexing, privacy, and owner controls', async () => {
  const doc = await readFile(new URL('../docs/echo-operations.md', import.meta.url), 'utf8');

  for (const requiredText of [
    'Cloudflare Vectorize',
    'my-life-echo-large',
    '3072',
    'ECHO_CHAT_API_KEY',
    'ECHO_EMBEDDING_API_KEY',
    'text-embedding-3-large',
    'wrangler vectorize create my-life-echo-large --dimensions=3072 --metric=cosine',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'ECHO_VECTORIZE_INDEX',
    'npm run echo:index',
    '不会保存访客的问题',
    '不会保存 AI 回复'
  ]) {
    assert.match(doc, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(doc, /sk-[A-Za-z0-9_-]{8,}/);
});

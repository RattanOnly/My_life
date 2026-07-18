import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Echo operations documentation covers Cloudflare setup, indexing, privacy, and owner controls', async () => {
  const doc = await readFile(new URL('../docs/echo-operations.md', import.meta.url), 'utf8');

  for (const requiredText of [
    'Cloudflare Vectorize',
    'my-life-echo-bge-m3',
    '1024',
    '@cf/baai/bge-m3',
    'ECHO_CHAT_API_KEY',
    'ECHO_CHAT_REASONING_EFFORT',
    'ECHO_INDEX_TOKEN',
    'ECHO_INDEX_URL',
    'wrangler vectorize create my-life-echo-bge-m3 --dimensions=1024 --metric=cosine',
    'extracts documents only',
    'protected Worker endpoint',
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

  assert.doesNotMatch(doc, /sk-[A-Za-z0-9_-]{8,}/);
});

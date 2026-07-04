import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildEchoDocuments,
  chunkEchoText,
  parsePostFrontMatter
} from '../scripts/build-echo-index.mjs';

test('parsePostFrontMatter reads published posts and excludes drafts', () => {
  const published = parsePostFrontMatter(`---
title: A boy wrote A blog
date: 2026-07-04
---

正文内容
`);
  assert.equal(published.data.title, 'A boy wrote A blog');
  assert.equal(published.data.draft, undefined);
  assert.equal(published.content.trim(), '正文内容');

  const draft = parsePostFrontMatter(`---
title: Hidden
draft: true
---

草稿
`);
  assert.equal(draft.data.draft, true);
});

test('chunkEchoText produces bounded chunks with stable indexes', () => {
  const chunks = chunkEchoText('一'.repeat(1500), { maxLength: 600 });

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].text.length <= 600);
  assert.equal(chunks[2].chunkIndex, 2);
});

test('buildEchoDocuments includes public posts and tone summary only', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'echo-index-'));
  await mkdir(path.join(root, 'source/_posts'), { recursive: true });
  await mkdir(path.join(root, 'source/_data'), { recursive: true });
  await writeFile(path.join(root, 'source/_posts/public.md'), `---
title: Public Post
date: 2026-07-04
---

公开文章正文
`);
  await writeFile(path.join(root, 'source/_posts/draft.md'), `---
title: Draft Post
draft: true
---

草稿正文
`);
  await writeFile(path.join(root, 'source/_data/echo-tone-summary.md'), '他常常写时间、家人、迷茫和继续往前走。');

  const documents = await buildEchoDocuments(root);

  assert.equal(documents.some(document => document.title === 'Draft Post'), false);
  assert.equal(documents.some(document => document.title === 'Public Post'), true);
  assert.equal(documents.some(document => document.id === 'owner-tone-summary-0'), true);
  assert.equal(documents.find(document => document.title === 'Public Post').path, '/2026/07/04/public/');
});

test('indexer file documents Vectorize and text-embedding-3-large defaults', async () => {
  const script = await readFile(new URL('../scripts/build-echo-index.mjs', import.meta.url), 'utf8');

  assert.match(script, /text-embedding-3-large/);
  assert.match(script, /ECHO_VECTORIZE/);
  assert.match(script, /CLOUDFLARE_ACCOUNT_ID/);
  assert.match(script, /CLOUDFLARE_API_TOKEN/);
  assert.match(script, /ECHO_VECTORIZE_INDEX/);
  assert.match(script, /\/vectors/);
  assert.match(script, /DELETE/);
  assert.match(script, /POST/);
});

test('package scripts run the Echo indexer after static builds without requiring local secrets', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(packageJson.scripts['echo:index'], 'node scripts/build-echo-index.mjs');
  assert.equal(packageJson.scripts.postbuild, 'node scripts/build-echo-index.mjs');
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('post body hook renders an Article Comment Area only for posts', async () => {
  const template = await readFile(new URL('../source/_data/post-body-end.swig', import.meta.url), 'utf8');

  assert.match(template, /page\.layout\s*===\s*'post'/);
  assert.match(template, /id="article-comments"/);
  assert.match(template, /data-endpoint="\/comments"/);
  assert.match(template, /name="name"[^>]*required/);
  assert.match(template, /name="email"/);
  assert.doesNotMatch(template, /name="email"[^>]*required/);
  assert.match(template, /name="body"[^>]*required/);
  assert.match(template, /\/js\/article-comments\.js/);
});

test('article comments script loads, submits, and renders comments safely', async () => {
  const script = await readFile(new URL('../source/js/article-comments.js', import.meta.url), 'utf8');

  assert.match(script, /fetch\(commentsUrl/);
  assert.match(script, /method:\s*'POST'/);
  assert.match(script, /window\.location\.pathname/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(script, /catch\s*\(/);
  assert.match(script, /dataset\.status\s*=\s*'unavailable'/);
  assert.doesNotMatch(script, /throw new Error/);
});

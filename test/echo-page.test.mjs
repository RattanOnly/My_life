import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Echo page renders a standalone AI conversation shell', async () => {
  const page = await readFile(new URL('../source/echo/index.md', import.meta.url), 'utf8');

  assert.match(page, /title:\s*Echo/);
  assert.match(page, /type:\s*echo/);
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="echo-page"/);
  assert.match(page, /data-echo-chat-endpoint="\/echo-chat"/);
  assert.match(page, /data-echo-status-endpoint="\/echo-status"/);
  assert.match(page, /data-echo-stage="idle_sit"/);
  assert.match(page, /这里不是他本人，只是一些从他的文字里长出来的回声。你的对话不会被保存。/);
  assert.match(page, /data-echo-messages/);
  assert.match(page, /data-echo-form/);
  assert.match(page, /name="message"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /\/js\/echo-chat\.js/);
});

test('Echo is available from the main navigation', async () => {
  const config = await readFile(new URL('../themes/next/_config.yml', import.meta.url), 'utf8');

  assert.match(config, /menu:\n(?:.*\n)*?\s+Echo:\s+\/echo\/\s+\|\|\s+fa fa-comment-dots/);
});

test('Echo styles define hand-drawn layout and reduced motion behavior', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.echo-page/);
  assert.match(styles, /\.echo-boy/);
  assert.match(styles, /\.echo-belt/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation:\s*none/);
});

test('Echo frontend does not use localStorage or sessionStorage for conversations', async () => {
  const script = await readFile(new URL('../source/js/echo-chat.js', import.meta.url), 'utf8');

  assert.doesNotMatch(script, /localStorage/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.doesNotMatch(script, /indexedDB/);
});

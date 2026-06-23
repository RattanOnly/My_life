import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('footer contains an Online Visitor Count container and client config', async () => {
  const footer = await readFile(new URL('../source/_data/footer.swig', import.meta.url), 'utf8');

  assert.match(footer, /id="visitor-online-count"/);
  assert.match(footer, /当前在线：/);
  assert.match(footer, /data-endpoint="\/online-count"/);
  assert.match(footer, /data-presence-endpoint="\/presence"/);
  assert.match(footer, /data-heartbeat-interval-ms="60000"/);
  assert.match(footer, /\/js\/visitor-online\.js/);
});

test('visitor online script fails gracefully when Worker calls fail', async () => {
  const script = await readFile(new URL('../source/js/visitor-online.js', import.meta.url), 'utf8');

  assert.match(script, /catch\s*\(/);
  assert.match(script, /dataset\.status\s*=\s*'unavailable'/);
  assert.doesNotMatch(script, /throw new Error/);
  assert.match(script, /fetch\(presenceEndpoint/);
  assert.match(script, /fetch\(countEndpoint/);
});

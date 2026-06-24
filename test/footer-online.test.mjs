import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('footer contains an Online Visitor Count container and client config', async () => {
  const footer = await readFile(new URL('../source/_data/footer.swig', import.meta.url), 'utf8');

  assert.match(footer, /id="visitor-online-count"/);
  assert.match(footer, /当前在线：/);
  assert.match(footer, /data-endpoint="https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/online-count"/);
  assert.match(footer, /data-presence-endpoint="https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/presence"/);
  assert.match(footer, /data-visit-endpoint="https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/visits"/);
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

test('visitor online script records a Visitor Log on page load and pjax navigation', async () => {
  const script = await readFile(new URL('../source/js/visitor-online.js', import.meta.url), 'utf8');

  assert.match(script, /visitEndpoint/);
  assert.match(script, /fetch\(visitEndpoint/);
  assert.match(script, /method:\s*'POST'/);
  assert.match(script, /JSON\.stringify\(\{\s*path/);
  assert.match(script, /lastRecordedPath/);
  assert.match(script, /window\.location\.pathname/);
  assert.match(script, /window\.location\.search/);
  assert.match(script, /pjax:success/);
});

test('visitor online script sends a stable anonymous Visitor ID for presence', async () => {
  const script = await readFile(new URL('../source/js/visitor-online.js', import.meta.url), 'utf8');

  assert.match(script, /VISITOR_ID_STORAGE_KEY/);
  assert.match(script, /visitor_online_id/);
  assert.match(script, /crypto\.randomUUID/);
  assert.match(script, /JSON\.stringify\(\{\s*visitorId:\s*getVisitorId\(\)\s*\}\)/);
});

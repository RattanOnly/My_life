import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { test } from 'node:test';

const routePatterns = [
  'lovezvv.com/comments*',
  'lovezvv.com/presence',
  'lovezvv.com/online-count',
  'lovezvv.com/visits',
  'lovezvv.com/admin-data*',
  'lovezvv.com/admin-comments*',
  'lovezvv.com/admin-owner-ip-marks*',
  'lovezvv.com/admin-visits',
  'lovezvv.com/echo-chat',
  'lovezvv.com/echo-status',
  'lovezvv.com/admin-echo',
  'lovezvv.com/admin-echo-usage',
  'www.lovezvv.com/comments*',
  'www.lovezvv.com/presence',
  'www.lovezvv.com/online-count',
  'www.lovezvv.com/visits',
  'www.lovezvv.com/admin-data*',
  'www.lovezvv.com/admin-comments*',
  'www.lovezvv.com/admin-owner-ip-marks*',
  'www.lovezvv.com/admin-visits',
  'www.lovezvv.com/echo-chat',
  'www.lovezvv.com/echo-status',
  'www.lovezvv.com/admin-echo',
  'www.lovezvv.com/admin-echo-usage'
];

test('Cloudflare Worker Routes own Visitor state API paths on production domains', async () => {
  const config = await readFile(new URL('../worker/wrangler.toml', import.meta.url), 'utf8');

  for (const pattern of routePatterns) {
    assert.match(config, new RegExp(`pattern\\s*=\\s*"${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`));
  }

  const zoneNameCount = (config.match(/zone_name\s*=\s*"lovezvv\.com"/g) || []).length;
  assert.equal(zoneNameCount, routePatterns.length);
  assert.match(config, /binding\s*=\s*"ECHO_VECTORIZE"/);
  assert.match(config, /index_name\s*=\s*"my-life-echo-large"/);
  assert.doesNotMatch(config, /netlify/i);
});

test('Netlify deployment configuration is not kept in the Cloudflare-only repository', async () => {
  const ignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');

  assert.match(ignore, /^netlify\.toml$/m);
  await assert.rejects(
    stat(new URL('../netlify.toml', import.meta.url)),
    error => error && error.code === 'ENOENT'
  );
});

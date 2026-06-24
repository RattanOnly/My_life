import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Netlify proxies Visitor state endpoints to the deployed Worker', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');

  for (const endpoint of ['/comments', '/presence', '/online-count', '/visits', '/admin-data', '/admin-comments', '/admin-owner-ip-marks', '/admin-visits']) {
    assert.match(config, new RegExp(`from\\s*=\\s*"${endpoint.replace('/', '\\/')}"`));
    assert.match(config, new RegExp(`to\\s*=\\s*"https:\\/\\/my-life-visitor-state\\.windking566\\.workers\\.dev${endpoint.replace('/', '\\/')}"`));
  }

  assert.match(config, /from\s*=\s*"\/admin-comments\/:id"/);
  assert.match(config, /to\s*=\s*"https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/admin-comments\/:id"/);
  assert.match(config, /from\s*=\s*"\/admin-owner-ip-marks\/:ipAddress"/);
  assert.match(config, /to\s*=\s*"https:\/\/my-life-visitor-state\.windking566\.workers\.dev\/admin-owner-ip-marks\/:ipAddress"/);
  assert.match(config, /status\s*=\s*200/);
  assert.match(config, /force\s*=\s*true/);
});

test('Netlify redirects old Chinese Article Paths to English slugs', async () => {
  const config = await readFile(new URL('../netlify.toml', import.meta.url), 'utf8');

  for (const [oldPath, newPath] of [
    ['/2026/06/22/风/', '/2026/06/22/wind/'],
    ['/2026/06/05/真假感情/', '/2026/06/05/feelings/'],
    ['/2026/01/14/一定要注意身体/', '/2026/01/14/health/'],
    ['/2026/02/06/你不必记录一切/', '/2026/02/06/let-go/']
  ]) {
    assert.match(config, new RegExp(`from\\s*=\\s*"${oldPath}"`));
    assert.match(config, new RegExp(`from\\s*=\\s*"${encodeURI(oldPath)}"`));
    assert.match(config, new RegExp(`to\\s*=\\s*"${newPath}"`));
  }

  assert.match(config, /status\s*=\s*301/);
  assert.match(config, /force\s*=\s*true/);
});

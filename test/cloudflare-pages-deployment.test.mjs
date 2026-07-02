import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('repository documents Cloudflare Pages as the static blog deployment path', async () => {
  const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');

  assert.match(readme, /Cloudflare Pages/);
  assert.match(readme, /npm run build/);
  assert.match(readme, /public/);
  assert.match(readme, /GitHub/);
  assert.doesNotMatch(readme, /Hexo 的 git deploy 流程/);
  assert.doesNotMatch(readme, /npm run deploy/);
});

test('old Hexo git deploy path is not kept as an active deployment option', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const config = await readFile(new URL('../_config.yml', import.meta.url), 'utf8');

  assert.equal(packageJson.scripts.deploy, undefined);
  assert.equal(packageJson.dependencies['hexo-deployer-git'], undefined);
  assert.doesNotMatch(config, /^deploy:/m);
  assert.doesNotMatch(config, /hexo-deployer-git/);
});

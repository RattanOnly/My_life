import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Rive runtime is copied from npm package before Hexo generation', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const copyScript = await readFile(new URL('../tools/echo/copy-rive-runtime.mjs', import.meta.url), 'utf8');
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');

  assert.equal(packageJson.dependencies['@rive-app/canvas-lite'], '^2.38.4');
  assert.equal(packageJson.scripts['copy:rive'], 'node tools/echo/copy-rive-runtime.mjs');
  assert.match(packageJson.scripts.build, /npm run copy:rive &&/);
  assert.match(packageJson.scripts.predev, /npm run copy:rive &&/);

  assert.match(copyScript, /@rive-app\/canvas-lite\/rive\.js/);
  assert.match(copyScript, /rive\.wasm/);
  assert.match(copyScript, /rive_fallback\.wasm/);
  assert.match(copyScript, /source\/vendor\/rive/);

  assert.match(gitignore, /^source\/vendor\/rive\/$/m);
});

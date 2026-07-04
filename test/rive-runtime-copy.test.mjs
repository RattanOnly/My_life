import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('Rive runtime is copied from npm package before Hexo generation', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const copyScript = await readFile(new URL('../tools/echo/copy-rive-runtime.mjs', import.meta.url), 'utf8');
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');

  assert.equal(packageJson.dependencies['@rive-app/canvas-lite'], '^2.38.4');
  assert.equal(packageJson.scripts['copy:rive'], 'node tools/echo/copy-rive-runtime.mjs');
  assert.equal(packageJson.scripts.build, 'npm run copy:rive && ./tools/hexo-env.sh generate');
  assert.equal(
    packageJson.scripts.predev,
    'npm run copy:rive && ./tools/hexo-env.sh clean && ./tools/hexo-env.sh generate && ./tools/hexo-env.sh algolia'
  );

  assert.match(copyScript, /@rive-app\/canvas-lite\/rive\.js/);
  assert.match(copyScript, /rive\.wasm/);
  assert.match(copyScript, /rive_fallback\.wasm/);
  assert.match(copyScript, /source\/vendor\/rive/);

  assert.match(gitignore, /^source\/vendor\/rive\/$/m);

  const root = await mkdtemp(path.join(tmpdir(), 'echo-rive-copy-'));
  try {
    const copyScriptPath = fileURLToPath(new URL('../tools/echo/copy-rive-runtime.mjs', import.meta.url));

    await execFileAsync(process.execPath, [copyScriptPath], { cwd: root });

    for (const fileName of ['rive.js', 'rive.wasm', 'rive_fallback.wasm']) {
      const file = await stat(path.join(root, 'source/vendor/rive', fileName));
      assert.ok(file.size > 0, `${fileName} should be copied with content`);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

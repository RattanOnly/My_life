import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('site author uses the preferred Rattan Holmes capitalization', async () => {
  const config = await readFile(new URL('../_config.yml', import.meta.url), 'utf8');

  assert.match(config, /author:\s*Rattan Holmes/);
  assert.doesNotMatch(config, /Rattan holmes/);
});

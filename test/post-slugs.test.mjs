import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { test } from 'node:test';

test('post source filenames use English URL slugs', async () => {
  const files = await readdir(new URL('../source/_posts/', import.meta.url));
  const markdownFiles = files.filter(file => file.endsWith('.md'));

  assert.ok(markdownFiles.length > 0);
  for (const file of markdownFiles) {
    assert.match(file, /^[a-z0-9-]+\.md$/);
  }
});

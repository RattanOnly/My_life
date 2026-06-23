import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Wrangler config declares the Visitor D1 binding with migration directory', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.match(config, /binding\s*=\s*"VISITOR_DB"/);
  assert.match(config, /migrations_dir\s*=\s*"migrations"/);
  assert.doesNotMatch(config, /ADMIN_PASSWORD\s*=/);
});

test('initial migration creates the sidecar metadata table', async () => {
  const migration = await readFile(
    new URL('../migrations/0001_initial_visitor_state.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS sidecar_meta/i);
  assert.match(migration, /schema_version/i);
});

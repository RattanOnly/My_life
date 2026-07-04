import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createEchoDb(firstResults = []) {
  const calls = [];

  return {
    calls,
    prepare(sql) {
      const call = { sql, values: [] };
      calls.push(call);

      return {
        bind(...values) {
          call.values = values;
          return this;
        },
        async run() {
          call.ran = true;
          return { success: true };
        },
        async all() {
          call.all = true;
          return { results: firstResults.shift() || [] };
        },
        async first() {
          call.first = true;
          return firstResults.shift() || null;
        }
      };
    }
  };
}

test('Echo migration creates settings and no-content usage metadata tables', async () => {
  const migration = await readFile(
    new URL('../migrations/0008_echo_ai.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS echo_settings/i);
  assert.match(migration, /setting_key\s+TEXT\s+PRIMARY KEY/i);
  assert.match(migration, /is_enabled/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS echo_usage_events/i);
  assert.match(migration, /event_status\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /prompt_tokens\s+INTEGER\s+NOT NULL\s+DEFAULT 0/i);
  assert.match(migration, /completion_tokens\s+INTEGER\s+NOT NULL\s+DEFAULT 0/i);
  assert.doesNotMatch(migration, /prompt_text/i);
  assert.doesNotMatch(migration, /reply_text/i);
  assert.doesNotMatch(migration, /conversation/i);
});

test('GET /echo-status returns public enabled state without admin password', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/echo-status'), {
    VISITOR_DB: db
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: true });
  assert.match(db.calls[0].sql, /FROM echo_settings/i);
  assert.deepEqual(db.calls[0].values, ['is_enabled']);
});

test('GET /admin-echo fails closed without Admin Password', async () => {
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-echo'), {
    VISITOR_DB: createEchoDb(),
    ADMIN_PASSWORD: 'secret-pass'
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Unauthorized' });
});

test('GET /admin-echo returns enabled state for the owner', async () => {
  const db = createEchoDb([{ setting_value: '0' }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-echo', {
    headers: { authorization: 'Bearer secret-pass' }
  }), {
    VISITOR_DB: db,
    ADMIN_PASSWORD: 'secret-pass'
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { enabled: false });
});

test('POST /admin-echo updates pause state for the owner', async () => {
  const db = createEchoDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-echo', {
    method: 'POST',
    headers: {
      authorization: 'Bearer secret-pass',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ enabled: true })
  }), {
    VISITOR_DB: db,
    ADMIN_PASSWORD: 'secret-pass'
  });

  assert.equal(response.status, 204);
  assert.match(db.calls[0].sql, /INSERT INTO echo_settings/i);
  assert.match(db.calls[0].sql, /ON CONFLICT/i);
  assert.deepEqual(db.calls[0].values, ['is_enabled', '1']);
});

test('GET /admin-echo-usage returns no-content usage summary', async () => {
  const db = createEchoDb([
    { total_count: 5, success_count: 4, failure_count: 1, prompt_tokens: 120, completion_tokens: 240 },
    [{ event_status: 'success', created_at: '2026-07-04T08:00:00.000Z', prompt_tokens: 20, completion_tokens: 40 }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-echo-usage', {
    headers: { authorization: 'Bearer secret-pass' }
  }), {
    VISITOR_DB: db,
    ADMIN_PASSWORD: 'secret-pass'
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    summary: {
      totalCount: 5,
      successCount: 4,
      failureCount: 1,
      promptTokens: 120,
      completionTokens: 240
    },
    recentEvents: [{
      status: 'success',
      createdAt: '2026-07-04T08:00:00.000Z',
      promptTokens: 20,
      completionTokens: 40
    }]
  });
  assert.doesNotMatch(db.calls[1].sql, /prompt_text|reply_text|conversation/i);
});

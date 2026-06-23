import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createRecordingDb() {
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
        async first() {
          call.first = true;
          return { ok: 1 };
        }
      };
    }
  };
}

test('POST /visits records a private Visitor Log with only the required fields', async () => {
  const db = createRecordingDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/visits', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    },
    body: JSON.stringify({ path: '/posts/family-note?from=home#private-fragment' })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO visitor_logs/i);
  assert.match(db.calls[0].sql, /ip_address/i);
  assert.match(db.calls[0].sql, /visited_at/i);
  assert.match(db.calls[0].sql, /visited_page/i);
  assert.match(db.calls[0].sql, /visitor_device_summary/i);

  const [ipAddress, visitedAt, visitedPage, deviceSummary] = db.calls[0].values;
  assert.equal(ipAddress, '203.0.113.10');
  assert.ok(!Number.isNaN(Date.parse(visitedAt)));
  assert.equal(visitedPage, '/posts/family-note?from=home');
  assert.equal(deviceSummary, 'Safari on iOS');
  assert.ok(deviceSummary.length <= 80);
  assert.doesNotMatch(deviceSummary, /17\.5|605\.1\.15|15E148|Mozilla/i);
});

test('GET /visits does not expose Visitor Logs through a public endpoint', async () => {
  const response = await worker.fetch(new Request('https://visitor.example.com/visits'), {
    VISITOR_DB: {
      prepare() {
        throw new Error('public read endpoint must not query Visitor Logs');
      }
    }
  });

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found' });
});

test('scheduled cleanup removes Visitor Logs older than 90 days', async () => {
  const db = createRecordingDb();

  await worker.scheduled({
    scheduledTime: Date.parse('2026-06-23T12:00:00.000Z')
  }, { VISITOR_DB: db }, {});

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /DELETE FROM visitor_logs/i);
  assert.match(db.calls[0].sql, /visited_at\s*<\s*\?1/i);
  assert.deepEqual(db.calls[0].values, ['2026-03-25T12:00:00.000Z']);
});

test('Visitor Log migration creates required fields and an access-time index', async () => {
  const migration = await readFile(
    new URL('../migrations/0002_visitor_logs.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS visitor_logs/i);
  assert.match(migration, /ip_address\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /visited_at\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /visited_page\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /visitor_device_summary\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_visitor_logs_visited_at/i);
});

test('Wrangler config schedules daily Visitor Log retention cleanup', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.match(config, /\[triggers\]/);
  assert.match(config, /crons\s*=\s*\[\s*"[^"]+"\s*\]/);
});

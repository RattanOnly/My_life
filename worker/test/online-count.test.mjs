import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createPresenceDb(firstResults = []) {
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
          return firstResults.shift() || { count: 0 };
        }
      };
    }
  };
}

test('POST /presence records a conservative Visitor heartbeat', async () => {
  const db = createPresenceDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/presence', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.21',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/125.0.0.0 Safari/537.36'
    },
    body: JSON.stringify({ visitorId: 'browser-visitor-1' })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO visitor_presence/i);
  assert.match(db.calls[0].sql, /ON CONFLICT\(visitor_key\) DO UPDATE/i);

  const [visitorKey, lastSeenAt] = db.calls[0].values;
  assert.equal(typeof visitorKey, 'string');
  assert.ok(visitorKey.length >= 24);
  assert.ok(!visitorKey.includes('203.0.113.21'));
  assert.ok(!Number.isNaN(Date.parse(lastSeenAt)));
});

test('POST /presence uses the browser Visitor ID instead of unstable proxy IPs', async () => {
  const db = createPresenceDb();

  const first = await worker.fetch(new Request('https://visitor.example.com/presence', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '198.51.100.10',
      'user-agent': 'Safari on iOS'
    },
    body: JSON.stringify({ visitorId: 'same-browser-id' })
  }), { VISITOR_DB: db });

  const second = await worker.fetch(new Request('https://visitor.example.com/presence', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.44',
      'user-agent': 'Chrome on Android'
    },
    body: JSON.stringify({ visitorId: 'same-browser-id' })
  }), { VISITOR_DB: db });

  assert.equal(first.status, 204);
  assert.equal(second.status, 204);
  assert.equal(db.calls.length, 2);
  assert.equal(db.calls[0].values[0], db.calls[1].values[0]);
  assert.ok(!db.calls[0].values[0].includes('same-browser-id'));
});

test('GET /online-count returns only the Online Visitor Count', async () => {
  const db = createPresenceDb([{ count: 3 }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/online-count'), {
    VISITOR_DB: db
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { count: 3 });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /SELECT COUNT\(\*\) AS count/i);
  assert.match(db.calls[0].sql, /FROM visitor_presence/i);
  assert.match(db.calls[0].sql, /last_seen_at\s*>=\s*\?1/i);
});

test('online count migration creates presence table and last-seen index', async () => {
  const migration = await readFile(
    new URL('../migrations/0003_visitor_presence.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS visitor_presence/i);
  assert.match(migration, /visitor_key\s+TEXT\s+PRIMARY KEY/i);
  assert.match(migration, /last_seen_at\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_visitor_presence_last_seen_at/i);
});

test('public Online Visitor endpoints allow the production site origin', async () => {
  const options = await worker.fetch(new Request('https://visitor.example.com/presence', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://lovezvv.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  }), { VISITOR_DB: createPresenceDb() });

  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
  assert.match(options.headers.get('access-control-allow-methods') || '', /POST/);
  assert.match(options.headers.get('access-control-allow-headers') || '', /content-type/i);

  const db = createPresenceDb([{ count: 1 }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/online-count', {
    headers: { origin: 'https://lovezvv.com' }
  }), { VISITOR_DB: db });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
});

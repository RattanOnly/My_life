import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createRecordingDb(firstResults = []) {
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
          return firstResults.shift() || { ok: 1 };
        }
      };
    }
  };
}

test('POST /visits records a private Visitor Log with only the required fields', async () => {
  const db = createRecordingDb();
  const request = new Request('https://visitor.example.com/visits', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': '203.0.113.10',
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
    },
    body: JSON.stringify({ path: '/posts/family-note?from=home#private-fragment' })
  });
  Object.defineProperty(request, 'cf', {
    value: { country: 'CN', region: 'Guangdong', city: 'Shenzhen' }
  });

  const response = await worker.fetch(request, { VISITOR_DB: db });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO visitor_logs/i);
  assert.match(db.calls[0].sql, /ip_address/i);
  assert.match(db.calls[0].sql, /visited_at/i);
  assert.match(db.calls[0].sql, /visited_page/i);
  assert.match(db.calls[0].sql, /visitor_device_summary/i);
  assert.match(db.calls[0].sql, /visitor_location/i);

  const [ipAddress, visitedAt, visitedPage, deviceSummary, visitorLocation] = db.calls[0].values;
  assert.equal(ipAddress, '203.0.113.10');
  assert.ok(!Number.isNaN(Date.parse(visitedAt)));
  assert.equal(visitedPage, '/posts/family-note?from=home');
  assert.equal(deviceSummary, 'Safari on iOS');
  assert.equal(visitorLocation, '中国 · Guangdong · Shenzhen');
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

test('GET /admin-data fails closed without a valid Admin Password', async () => {
  const env = { VISITOR_DB: createRecordingDb(), ADMIN_PASSWORD: 'secret-pass' };

  const missing = await worker.fetch(new Request('https://visitor.example.com/admin-data'), env);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Unauthorized' });

  const invalid = await worker.fetch(new Request('https://visitor.example.com/admin-data', {
    headers: { authorization: 'Bearer wrong-pass' }
  }), env);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Unauthorized' });
});

test('GET /admin-data returns recent Visitor Logs and Online Visitor Count for the owner', async () => {
  const db = createRecordingDb([
    { count: 2 },
    { total_count: 1 },
    [{
      id: 7,
      ip_address: '203.0.113.21',
      visited_at: '2026-06-23T12:00:00.000Z',
      visited_page: '/2026/06/05/example-post/',
      visitor_device_summary: 'Chrome on macOS',
      visitor_location: '美国 · California · San Francisco',
      is_owner_visitor: 1
    }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-data', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    onlineCount: 2,
    visitorLogs: [{
      id: 7,
      ipAddress: '203.0.113.21',
      visitedAt: '2026-06-23T12:00:00.000Z',
      visitedPage: '/2026/06/05/example-post/',
      visitorDeviceSummary: 'Chrome on macOS',
      visitorLocation: '美国 · California · San Francisco',
      isOwnerVisitor: true
    }],
    visitorLogsPagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1
    }
  });
  assert.match(db.calls[1].sql, /COUNT\(\*\)\s+AS\s+total_count/i);
  assert.match(db.calls[2].sql, /LEFT JOIN owner_ip_marks/i);
  assert.match(db.calls[2].sql, /visitor_location/i);
  assert.match(db.calls[2].sql, /LIMIT\s+\?/i);
  assert.match(db.calls[2].sql, /OFFSET\s+\?/i);
  assert.deepEqual(db.calls[2].values, [20, 0]);
});

test('GET /admin-data paginates and filters Visitor Logs for the owner', async () => {
  const db = createRecordingDb([
    { count: 3 },
    { total_count: 27 },
    [{
      id: 9,
      ip_address: '198.51.100.9',
      visited_at: '2026-06-23T12:00:00.000Z',
      visited_page: '/2026/06/05/feelings/',
      visitor_device_summary: 'Safari on iOS',
      visitor_location: '中国 · Jiangsu · Nanjing',
      is_owner_visitor: 0
    }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-data?visitorPage=2&visitorPageSize=20&visitorOwner=visitor&visitorPageKeyword=feelings&visitorFrom=2026-06-01&visitorTo=2026-06-30', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    onlineCount: 3,
    visitorLogs: [{
      id: 9,
      ipAddress: '198.51.100.9',
      visitedAt: '2026-06-23T12:00:00.000Z',
      visitedPage: '/2026/06/05/feelings/',
      visitorDeviceSummary: 'Safari on iOS',
      visitorLocation: '中国 · Jiangsu · Nanjing',
      isOwnerVisitor: false
    }],
    visitorLogsPagination: {
      page: 2,
      pageSize: 20,
      total: 27,
      totalPages: 2
    }
  });

  assert.match(db.calls[1].sql, /visitor_logs\.visited_at\s+>=\s+\?1/i);
  assert.match(db.calls[1].sql, /visitor_logs\.visited_at\s+<\s+\?2/i);
  assert.match(db.calls[1].sql, /visitor_logs\.visited_page\s+LIKE\s+\?3/i);
  assert.match(db.calls[1].sql, /owner_ip_marks\.ip_address\s+IS\s+NULL/i);
  assert.deepEqual(db.calls[1].values, [
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '%feelings%'
  ]);
  assert.deepEqual(db.calls[2].values, [
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '%feelings%',
    20,
    20
  ]);
});

test('scheduled cleanup removes Visitor Logs older than 30 days', async () => {
  const db = createRecordingDb();

  await worker.scheduled({
    scheduledTime: Date.parse('2026-06-23T12:00:00.000Z')
  }, { VISITOR_DB: db }, {});

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /DELETE FROM visitor_logs/i);
  assert.match(db.calls[0].sql, /visited_at\s*<\s*\?1/i);
  assert.deepEqual(db.calls[0].values, ['2026-05-24T12:00:00.000Z']);
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

test('Visitor Log location and Owner Visitor migration adds required fields', async () => {
  const migration = await readFile(
    new URL('../migrations/0005_visitor_log_location_and_owner_ip.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /ALTER TABLE visitor_logs ADD COLUMN visitor_location TEXT/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS owner_ip_marks/i);
  assert.match(migration, /ip_address\s+TEXT\s+PRIMARY KEY/i);
  assert.match(migration, /created_at\s+TEXT\s+NOT NULL/i);
});

test('POST /admin-owner-ip-marks marks an Owner Visitor IP only for the owner', async () => {
  const unauthorizedDb = createRecordingDb();
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-owner-ip-marks', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ipAddress: '203.0.113.21' })
  }), { VISITOR_DB: unauthorizedDb, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorizedDb.calls.length, 0);

  const db = createRecordingDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-owner-ip-marks', {
    method: 'POST',
    headers: {
      authorization: 'Bearer secret-pass',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ ipAddress: '203.0.113.21' })
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO owner_ip_marks/i);
  assert.match(db.calls[0].sql, /ON CONFLICT/i);
  assert.equal(db.calls[0].values[0], '203.0.113.21');
  assert.ok(!Number.isNaN(Date.parse(db.calls[0].values[1])));
});

test('DELETE /admin-owner-ip-marks/:ipAddress removes an Owner Visitor mark only for the owner', async () => {
  const unauthorizedDb = createRecordingDb();
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-owner-ip-marks/203.0.113.21', {
    method: 'DELETE'
  }), { VISITOR_DB: unauthorizedDb, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorizedDb.calls.length, 0);

  const db = createRecordingDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-owner-ip-marks/203.0.113.21', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /DELETE FROM owner_ip_marks/i);
  assert.equal(db.calls[0].values[0], '203.0.113.21');
});

test('DELETE /admin-visits clears Visitor Logs only for the owner', async () => {
  const unauthorizedDb = createRecordingDb();
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-visits', {
    method: 'DELETE'
  }), { VISITOR_DB: unauthorizedDb, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);
  assert.equal(unauthorizedDb.calls.length, 0);

  const db = createRecordingDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-visits', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /DELETE FROM visitor_logs/i);
});

test('Wrangler config schedules daily Visitor Log retention cleanup', async () => {
  const config = await readFile(new URL('../wrangler.toml', import.meta.url), 'utf8');

  assert.match(config, /\[triggers\]/);
  assert.match(config, /crons\s*=\s*\[\s*"[^"]+"\s*\]/);
});

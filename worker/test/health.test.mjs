import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.mjs';

test('GET /health returns sidecar status and confirms D1 binding', async () => {
  const env = {
    VISITOR_DB: {
      prepare(sql) {
        assert.match(sql, /select\s+1/i);
        return {
          async first() {
            return { ok: 1 };
          }
        };
      }
    }
  };

  const response = await worker.fetch(new Request('https://visitor.example.com/health'), env);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'application/json');
  assert.deepEqual(await response.json(), {
    ok: true,
    service: 'visitor-state-sidecar',
    database: 'reachable'
  });
});

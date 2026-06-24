import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createCommentDb(firstResults = []) {
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
          return { success: true, meta: { last_row_id: 42 } };
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

test('POST /comments publishes an Anonymous Comment immediately', async () => {
  const db = createCommentDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      name: '花花',
      email: 'reader@example.com',
      body: '写得真好。'
    })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.deepEqual(Object.keys(body.comment).sort(), ['body', 'createdAt', 'id', 'name'].sort());
  assert.equal(body.comment.id, 42);
  assert.equal(body.comment.name, '花花');
  assert.equal(body.comment.body, '写得真好。');
  assert.ok(!Number.isNaN(Date.parse(body.comment.createdAt)));
  assert.equal(body.comment.email, undefined);

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO article_comments/i);
  assert.match(db.calls[0].sql, /comment_email/i);
  assert.deepEqual(db.calls[0].values.slice(0, 4), [
    '/2026/06/05/example-post/',
    '花花',
    'reader@example.com',
    '写得真好。'
  ]);
});

test('POST /comments requires Comment Name and comment body but not Comment Email', async () => {
  const missingName = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      name: '  ',
      body: 'hello'
    })
  }), { VISITOR_DB: createCommentDb() });

  assert.equal(missingName.status, 400);
  assert.deepEqual(await missingName.json(), { error: 'Comment Name is required' });

  const missingBody = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      name: '花花',
      email: ''
    })
  }), { VISITOR_DB: createCommentDb() });

  assert.equal(missingBody.status, 400);
  assert.deepEqual(await missingBody.json(), { error: 'Comment body is required' });

  const db = createCommentDb();
  const withoutEmail = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      name: '花花',
      body: '不用邮箱也能评论。'
    })
  }), { VISITOR_DB: db });

  assert.equal(withoutEmail.status, 201);
  assert.equal(db.calls[0].values[2], null);
});

test('GET /comments returns Published Comments for one article without private email', async () => {
  const db = createCommentDb([[
    {
      id: 1,
      comment_name: '家人',
      comment_email: 'private@example.com',
      comment_body: '我也看到了。',
      created_at: '2026-06-23T12:00:00.000Z'
    }
  ]]);

  const response = await worker.fetch(
    new Request('https://visitor.example.com/comments?path=/2026/06/05/example-post/?from=home'),
    { VISITOR_DB: db }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 1,
      name: '家人',
      body: '我也看到了。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }]
  });
  assert.match(db.calls[0].sql, /SELECT\s+id,\s*comment_name,\s*comment_body,\s*created_at/i);
  assert.doesNotMatch(db.calls[0].sql, /comment_email/i);
  assert.deepEqual(db.calls[0].values, ['/2026/06/05/example-post/']);
});

test('GET /comments reads English slug comments and old Chinese path aliases together', async () => {
  const db = createCommentDb([[
    {
      id: 1,
      comment_name: '家人',
      comment_body: '旧路径也能看到。',
      created_at: '2026-06-23T12:00:00.000Z'
    }
  ]]);

  const response = await worker.fetch(
    new Request('https://visitor.example.com/comments?path=/2026/06/05/feelings/&aliases=%2F2026%2F06%2F05%2F%E7%9C%9F%E5%81%87%E6%84%9F%E6%83%85%2F'),
    { VISITOR_DB: db }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 1,
      name: '家人',
      body: '旧路径也能看到。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }]
  });
  assert.match(db.calls[0].sql, /article_path IN \(\?1,\?2\)/i);
  assert.deepEqual(db.calls[0].values, [
    '/2026/06/05/feelings/',
    '/2026/06/05/%E7%9C%9F%E5%81%87%E6%84%9F%E6%83%85/'
  ]);
});

test('public Comment endpoints allow the production site origin', async () => {
  const options = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://lovezvv.com',
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type'
    }
  }), { VISITOR_DB: createCommentDb() });

  assert.equal(options.status, 204);
  assert.equal(options.headers.get('access-control-allow-origin'), 'https://lovezvv.com');

  const db = createCommentDb([[]]);
  const response = await worker.fetch(new Request('https://visitor.example.com/comments?path=/2026/06/05/example-post/', {
    headers: { origin: 'https://lovezvv.com' }
  }), { VISITOR_DB: db });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
});

test('GET /admin-comments fails closed without a valid Admin Password', async () => {
  const env = { VISITOR_DB: createCommentDb(), ADMIN_PASSWORD: 'secret-pass' };

  const missing = await worker.fetch(new Request('https://visitor.example.com/admin-comments'), env);
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: 'Unauthorized' });

  const invalid = await worker.fetch(new Request('https://visitor.example.com/admin-comments', {
    headers: { authorization: 'Bearer wrong-pass' }
  }), env);
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'Unauthorized' });
});

test('GET /admin-comments returns private comment details for the owner', async () => {
  const db = createCommentDb([[
    {
      id: 11,
      article_path: '/2026/06/05/example-post/',
      comment_name: '家人',
      comment_email: 'private@example.com',
      comment_body: '我也看到了。',
      created_at: '2026-06-23T12:00:00.000Z'
    }
  ]]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 11,
      articlePath: '/2026/06/05/example-post/',
      name: '家人',
      email: 'private@example.com',
      body: '我也看到了。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }]
  });
});

test('DELETE /admin-comments/:id deletes one comment only for the owner', async () => {
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE'
  }), { VISITOR_DB: createCommentDb(), ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);

  const db = createCommentDb();
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.match(db.calls[0].sql, /DELETE FROM article_comments/i);
  assert.deepEqual(db.calls[0].values, [11]);
});

test('article comments migration creates the Published Comment table', async () => {
  const migration = await readFile(
    new URL('../migrations/0004_article_comments.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /CREATE TABLE IF NOT EXISTS article_comments/i);
  assert.match(migration, /article_path\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /comment_name\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /comment_email\s+TEXT/i);
  assert.match(migration, /comment_body\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /created_at\s+TEXT\s+NOT NULL/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_article_comments_article_path_created_at/i);
});

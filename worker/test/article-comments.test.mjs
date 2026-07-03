import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import worker from '../src/index.mjs';

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

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
  assert.deepEqual(Object.keys(body.comment).sort(), ['body', 'canDeleteUntil', 'createdAt', 'deleteToken', 'id', 'name', 'parentId'].sort());
  assert.equal(body.comment.id, 42);
  assert.equal(body.comment.name, '花花');
  assert.equal(body.comment.body, '写得真好。');
  assert.equal(body.comment.parentId, null);
  assert.equal(typeof body.comment.deleteToken, 'string');
  assert.ok(body.comment.deleteToken.length >= 32);
  assert.ok(!Number.isNaN(Date.parse(body.comment.canDeleteUntil)));
  assert.ok(!Number.isNaN(Date.parse(body.comment.createdAt)));
  assert.equal(body.comment.email, undefined);

  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO article_comments/i);
  assert.match(db.calls[0].sql, /comment_email/i);
  assert.match(db.calls[0].sql, /parent_comment_id/i);
  assert.match(db.calls[0].sql, /delete_token_hash/i);
  assert.deepEqual(db.calls[0].values.slice(0, 4), [
    '/2026/06/05/example-post/',
    '花花',
    'reader@example.com',
    '写得真好。'
  ]);
  assert.equal(db.calls[0].values[5], null);
  assert.equal(db.calls[0].values[6].length, 64);
  assert.notEqual(db.calls[0].values[6], body.comment.deleteToken);
});

test('POST /comments publishes a one-level Comment Reply', async () => {
  const db = createCommentDb([
    {
      id: 5,
      parent_comment_id: null
    }
  ]);
  const response = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      parentId: 5,
      name: '家人',
      body: '我回复你。'
    })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.comment.id, 42);
  assert.equal(body.comment.parentId, 5);
  assert.equal(body.comment.name, '家人');
  assert.equal(body.comment.body, '我回复你。');
  assert.equal(body.comment.createdAt, db.calls[1].values[4]);
  assert.equal(typeof body.comment.deleteToken, 'string');
  assert.ok(!Number.isNaN(Date.parse(body.comment.canDeleteUntil)));
  assert.match(db.calls[0].sql, /SELECT\s+id,\s*parent_comment_id/i);
  assert.deepEqual(db.calls[0].values, [5]);
  assert.equal(db.calls[1].values[5], 5);
});

test('POST /comments replying to a reply attaches to the top-level Comment Reply parent', async () => {
  const db = createCommentDb([
    {
      id: 8,
      parent_comment_id: 5
    }
  ]);
  const response = await worker.fetch(new Request('https://visitor.example.com/comments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      path: '/2026/06/05/example-post/',
      parentId: 8,
      name: '家人',
      body: '继续回复。'
    })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.comment.parentId, 5);
  assert.equal(db.calls[1].values[5], 5);
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
      parent_comment_id: null,
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
      parentId: null,
      name: '家人',
      body: '我也看到了。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }]
  });
  assert.match(db.calls[0].sql, /SELECT\s+id,\s*parent_comment_id,\s*comment_name,\s*comment_body,\s*deleted_at,\s*created_at/i);
  assert.doesNotMatch(db.calls[0].sql, /comment_email/i);
  assert.deepEqual(db.calls[0].values, ['/2026/06/05/example-post/']);
});

test('GET /comments returns Comment Replies with their top-level parent id', async () => {
  const db = createCommentDb([[
    {
      id: 1,
      parent_comment_id: null,
      comment_name: '花花',
      comment_body: '原评论。',
      created_at: '2026-06-23T12:00:00.000Z'
    },
    {
      id: 2,
      parent_comment_id: 1,
      comment_name: '家人',
      comment_body: '回复。',
      created_at: '2026-06-23T12:01:00.000Z'
    }
  ]]);

  const response = await worker.fetch(
    new Request('https://visitor.example.com/comments?path=/2026/06/05/example-post/'),
    { VISITOR_DB: db }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [
      {
        id: 1,
        parentId: null,
        name: '花花',
        body: '原评论。',
        createdAt: '2026-06-23T12:00:00.000Z'
      },
      {
        id: 2,
        parentId: 1,
        name: '家人',
        body: '回复。',
        createdAt: '2026-06-23T12:01:00.000Z'
      }
    ]
  });
});

test('GET /comments returns Deleted Comment placeholders without original content', async () => {
  const db = createCommentDb([[
    {
      id: 1,
      parent_comment_id: null,
      comment_name: '花花',
      comment_body: '不要公开',
      deleted_at: '2026-06-23T12:05:00.000Z',
      created_at: '2026-06-23T12:00:00.000Z'
    },
    {
      id: 2,
      parent_comment_id: 1,
      comment_name: '家人',
      comment_body: '回复还在。',
      deleted_at: null,
      created_at: '2026-06-23T12:01:00.000Z'
    }
  ]]);

  const response = await worker.fetch(
    new Request('https://visitor.example.com/comments?path=/2026/06/05/example-post/'),
    { VISITOR_DB: db }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [
      {
        id: 1,
        parentId: null,
        name: '评论已删除',
        body: '评论已删除',
        createdAt: '2026-06-23T12:00:00.000Z',
        isDeleted: true
      },
      {
        id: 2,
        parentId: 1,
        name: '家人',
        body: '回复还在。',
        createdAt: '2026-06-23T12:01:00.000Z'
      }
    ]
  });
});

test('GET /comments reads English slug comments and old Chinese path aliases together', async () => {
  const db = createCommentDb([[
    {
      id: 1,
      parent_comment_id: null,
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
      parentId: null,
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
  assert.match(options.headers.get('access-control-allow-methods') || '', /DELETE/);

  const deleteOptions = await worker.fetch(new Request('https://visitor.example.com/comments/11', {
    method: 'OPTIONS',
    headers: {
      origin: 'https://lovezvv.com',
      'access-control-request-method': 'DELETE',
      'access-control-request-headers': 'content-type'
    }
  }), { VISITOR_DB: createCommentDb() });

  assert.equal(deleteOptions.status, 204);
  assert.equal(deleteOptions.headers.get('access-control-allow-origin'), 'https://lovezvv.com');

  const db = createCommentDb([[]]);
  const response = await worker.fetch(new Request('https://visitor.example.com/comments?path=/2026/06/05/example-post/', {
    headers: { origin: 'https://lovezvv.com' }
  }), { VISITOR_DB: db });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
});

test('DELETE /comments/:id allows Visitor Comment Deletion from the same browser during the deletion window', async () => {
  const deleteToken = 'same-browser-delete-token';
  const db = createCommentDb([
    {
      id: 11,
      created_at: new Date().toISOString(),
      delete_token_hash: await sha256Hex(deleteToken)
    },
    { reply_count: 0 }
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/comments/11', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleteToken })
  }), { VISITOR_DB: db });

  assert.equal(response.status, 204);
  assert.match(db.calls[0].sql, /SELECT\s+id,\s*created_at,\s*delete_token_hash/i);
  assert.match(db.calls[2].sql, /DELETE FROM article_comments/i);
  assert.deepEqual(db.calls[2].values, [11]);
});

test('DELETE /comments/:id rejects missing, wrong, or expired Visitor Comment Deletion tokens', async () => {
  const missingToken = await worker.fetch(new Request('https://visitor.example.com/comments/11', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({})
  }), { VISITOR_DB: createCommentDb() });
  assert.equal(missingToken.status, 403);

  const wrongTokenDb = createCommentDb([{
    id: 11,
    created_at: new Date().toISOString(),
    delete_token_hash: await sha256Hex('correct-token')
  }]);
  const wrongToken = await worker.fetch(new Request('https://visitor.example.com/comments/11', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleteToken: 'wrong-token' })
  }), { VISITOR_DB: wrongTokenDb });
  assert.equal(wrongToken.status, 403);

  const expiredDb = createCommentDb([{
    id: 11,
    created_at: '2026-06-23T12:00:00.000Z',
    delete_token_hash: await sha256Hex('old-token')
  }]);
  const expired = await worker.fetch(new Request('https://visitor.example.com/comments/11', {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deleteToken: 'old-token' })
  }), { VISITOR_DB: expiredDb });
  assert.equal(expired.status, 410);
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
  const db = createCommentDb([
    { total_count: 1 },
    [{
      id: 11,
      article_path: '/2026/06/05/example-post/',
      comment_name: '家人',
      comment_email: 'private@example.com',
      comment_body: '我也看到了。',
      parent_comment_id: null,
      created_at: '2026-06-23T12:00:00.000Z'
    }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 11,
      articlePath: '/2026/06/05/example-post/',
      parentId: null,
      name: '家人',
      email: 'private@example.com',
      body: '我也看到了。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }],
    commentsPagination: {
      page: 1,
      pageSize: 20,
      total: 1,
      totalPages: 1
    }
  });
  assert.match(db.calls[0].sql, /COUNT\(\*\)\s+AS\s+total_count/i);
  assert.match(db.calls[1].sql, /LIMIT\s+\?/i);
  assert.match(db.calls[1].sql, /OFFSET\s+\?/i);
  assert.deepEqual(db.calls[1].values, [20, 0]);
});

test('GET /admin-comments paginates and filters Comment Management for the owner', async () => {
  const db = createCommentDb([
    { total_count: 22 },
    [{
      id: 12,
      article_path: '/2026/06/05/feelings/',
      comment_name: '家人',
      comment_email: null,
      comment_body: '我也想你。',
      parent_comment_id: 11,
      created_at: '2026-06-23T12:00:00.000Z'
    }]
  ]);

  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments?commentPage=2&commentPageSize=20&commentFrom=2026-06-01&commentTo=2026-06-30&commentArticlePathKeyword=feelings&commentKeyword=%E6%83%B3', {
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    comments: [{
      id: 12,
      articlePath: '/2026/06/05/feelings/',
      parentId: 11,
      name: '家人',
      email: null,
      body: '我也想你。',
      createdAt: '2026-06-23T12:00:00.000Z'
    }],
    commentsPagination: {
      page: 2,
      pageSize: 20,
      total: 22,
      totalPages: 2
    }
  });

  assert.match(db.calls[0].sql, /created_at\s+>=\s+\?1/i);
  assert.match(db.calls[0].sql, /created_at\s+<\s+\?2/i);
  assert.match(db.calls[0].sql, /article_path\s+LIKE\s+\?3/i);
  assert.match(db.calls[0].sql, /comment_name\s+LIKE\s+\?4/i);
  assert.match(db.calls[0].sql, /comment_body\s+LIKE\s+\?5/i);
  assert.deepEqual(db.calls[0].values, [
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '%feelings%',
    '%想%',
    '%想%'
  ]);
  assert.deepEqual(db.calls[1].values, [
    '2026-06-01T00:00:00.000Z',
    '2026-07-01T00:00:00.000Z',
    '%feelings%',
    '%想%',
    '%想%',
    20,
    20
  ]);
});

test('DELETE /admin-comments/:id deletes one comment only for the owner', async () => {
  const unauthorized = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE'
  }), { VISITOR_DB: createCommentDb(), ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(unauthorized.status, 401);

  const db = createCommentDb([{ reply_count: 0 }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.match(db.calls[1].sql, /DELETE FROM article_comments/i);
  assert.deepEqual(db.calls[1].values, [11]);
});

test('DELETE /admin-comments/:id leaves a Deleted Comment when Comment Replies exist', async () => {
  const db = createCommentDb([{ reply_count: 2 }]);
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-comments/11', {
    method: 'DELETE',
    headers: { authorization: 'Bearer secret-pass' }
  }), { VISITOR_DB: db, ADMIN_PASSWORD: 'secret-pass' });

  assert.equal(response.status, 204);
  assert.match(db.calls[1].sql, /UPDATE article_comments/i);
  assert.match(db.calls[1].sql, /deleted_at/i);
  assert.deepEqual(db.calls[1].values.slice(0, 1), [11]);
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

test('comment replies migration adds one-level Comment Reply fields', async () => {
  const migration = await readFile(
    new URL('../migrations/0006_comment_replies.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /ALTER TABLE article_comments ADD COLUMN parent_comment_id INTEGER/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_article_comments_parent_comment_id/i);
});

test('comment deletion migration adds Visitor Comment Deletion fields', async () => {
  const migration = await readFile(
    new URL('../migrations/0007_comment_deletion.sql', import.meta.url),
    'utf8'
  );

  assert.match(migration, /ALTER TABLE article_comments ADD COLUMN delete_token_hash TEXT/i);
  assert.match(migration, /ALTER TABLE article_comments ADD COLUMN deleted_at TEXT/i);
  assert.match(migration, /CREATE INDEX IF NOT EXISTS idx_article_comments_deleted_at/i);
});

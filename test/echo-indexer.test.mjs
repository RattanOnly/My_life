import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  buildEchoDocuments,
  buildEchoVectors,
  chunkEchoText,
  createEmbedding,
  parsePostFrontMatter,
  rebuildVectorizeIndex,
  upsertVectorizeVectors
} from '../tools/echo/build-index.mjs';

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status || 200,
    headers: { 'content-type': 'application/json' }
  });
}

function createFetchStub(handler) {
  const calls = [];
  const fetchStub = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return handler(String(url), options, calls);
  };
  fetchStub.calls = calls;
  return fetchStub;
}

function remoteEnv(overrides = {}) {
  return {
    CLOUDFLARE_ACCOUNT_ID: 'account-id',
    CLOUDFLARE_API_TOKEN: 'cf-token',
    ECHO_VECTORIZE_INDEX: 'echo-index',
    ECHO_EMBEDDING_API_KEY: 'embedding-key',
    ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com',
    ECHO_EMBEDDING_DIMENSIONS: '3',
    ...overrides
  };
}

test('parsePostFrontMatter reads published posts and excludes drafts', () => {
  const published = parsePostFrontMatter(`---
title: A boy wrote A blog
date: 2026-07-04
---

正文内容
`);
  assert.equal(published.data.title, 'A boy wrote A blog');
  assert.equal(published.data.draft, undefined);
  assert.equal(published.content.trim(), '正文内容');

  const draft = parsePostFrontMatter(`---
title: Hidden
draft: true
---

草稿
`);
  assert.equal(draft.data.draft, true);
});

test('chunkEchoText produces bounded chunks with stable indexes', () => {
  const chunks = chunkEchoText('一'.repeat(1500), { maxLength: 600 });

  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].chunkIndex, 0);
  assert.ok(chunks[0].text.length <= 600);
  assert.equal(chunks[2].chunkIndex, 2);
});

test('buildEchoDocuments includes public posts, owner profile, and tone summary only', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'echo-index-'));
  await mkdir(path.join(root, 'source/_posts'), { recursive: true });
  await mkdir(path.join(root, 'source/_data'), { recursive: true });
  await writeFile(path.join(root, 'source/_posts/public.md'), `---
title: Public Post
date: 2026-07-04
---

公开文章正文
`);
  await writeFile(path.join(root, 'source/_posts/draft.md'), `---
title: Draft Post
draft: true
---

草稿正文
`);
  await writeFile(path.join(root, 'source/_data/echo-owner-profile.md'), '赵威创造了这个网站和回声。亲近的人也可以叫他威威。');
  await writeFile(path.join(root, 'source/_data/echo-tone-summary.md'), '他常常写时间、家人、迷茫和继续往前走。');

  const documents = await buildEchoDocuments(root);

  assert.equal(documents.some(document => document.title === 'Draft Post'), false);
  assert.equal(documents.some(document => document.title === 'Public Post'), true);
  assert.equal(documents.some(document => document.id === 'owner-public-profile-0'), true);
  assert.equal(documents.some(document => document.id === 'owner-tone-summary-0'), true);
  assert.equal(
    documents.find(document => document.id === 'owner-public-profile-0').title,
    'Owner-Approved Public Profile'
  );
  assert.match(documents.find(document => document.id === 'owner-public-profile-0').text, /赵威/);
  assert.match(documents.find(document => document.id === 'owner-public-profile-0').text, /威威/);
  assert.equal(documents.find(document => document.title === 'Public Post').path, '/2026/07/04/public/');
});

test('rebuildVectorizeIndex skips remote requests without Cloudflare env', async () => {
  const fetchStub = createFetchStub(() => {
    throw new Error('fetch should not be called');
  });

  await rebuildVectorizeIndex([
    {
      id: 'public-0',
      title: 'Public',
      path: '/2026/07/04/public/',
      text: '公开正文',
      chunkIndex: 0
    }
  ], {
    ECHO_EMBEDDING_API_KEY: 'embedding-key',
    ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
  }, { fetchImpl: fetchStub });

  assert.equal(fetchStub.calls.length, 0);
});

test('rebuildVectorizeIndex sends documents to the protected Worker index endpoint', async () => {
  const fetchStub = createFetchStub((url, options) => {
    assert.equal(url, 'https://lovezvv.com/echo-index');
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.authorization, 'Bearer private-index-token');
    return jsonResponse({ indexed: 1 });
  });
  const documents = [{
    id: 'now-and-before-0',
    title: '现在和从前',
    path: '/2026/07/12/now-and-before/',
    text: '我开始重新看待现在和从前。',
    chunkIndex: 0
  }];

  const result = await rebuildVectorizeIndex(documents, {
    ECHO_INDEX_URL: 'https://lovezvv.com/echo-index',
    ECHO_INDEX_TOKEN: 'private-index-token'
  }, { fetchImpl: fetchStub });

  assert.deepEqual(result, { skipped: false, count: 1 });
  assert.deepEqual(JSON.parse(fetchStub.calls[0].options.body), { documents });
});

test('createEmbedding does not duplicate v1 in provider base URLs', async () => {
  const fetchStub = createFetchStub(() => jsonResponse({
    data: [{ embedding: [0.1, 0.2, 0.3] }]
  }));

  const embedding = await createEmbedding('公开正文', remoteEnv({
    ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com/v1'
  }), { fetchImpl: fetchStub });

  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
  assert.equal(fetchStub.calls[0].url, 'https://embedding.example.com/v1/embeddings');
  assert.ok(!fetchStub.calls[0].url.includes('/v1/v1/'));
});

test('bad embedding responses stop before Vectorize upsert or delete', async () => {
  const fetchStub = createFetchStub(url => {
    assert.match(url, /\/embeddings$/);
    return jsonResponse({ data: [{ embedding: [0.1, null, 0.3] }] });
  });

  await assert.rejects(
    rebuildVectorizeIndex([
      {
        id: 'public-0',
        title: 'Public',
        path: '/2026/07/04/public/',
        text: '公开正文',
        chunkIndex: 0
      }
    ], remoteEnv(), { fetchImpl: fetchStub }),
    /ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE/
  );

  assert.equal(fetchStub.calls.length, 1);
  assert.equal(fetchStub.calls.some(call => call.url.includes('/vectorize/')), false);
  assert.equal(fetchStub.calls.some(call => call.options.method === 'DELETE'), false);
});

test('embedding dimension mismatch stops before Vectorize upsert', async () => {
  const fetchStub = createFetchStub(url => {
    assert.match(url, /\/embeddings$/);
    return jsonResponse({ data: [{ embedding: [0.1, 0.2] }] });
  });

  await assert.rejects(
    rebuildVectorizeIndex([
      {
        id: 'public-0',
        title: 'Public',
        path: '/2026/07/04/public/',
        text: '公开正文',
        chunkIndex: 0
      }
    ], remoteEnv(), { fetchImpl: fetchStub }),
    /ECHO_EMBEDDING_PROVIDER_INVALID_DIMENSION/
  );

  assert.equal(fetchStub.calls.length, 1);
  assert.equal(fetchStub.calls.some(call => call.url.includes('/vectorize/')), false);
});

test('buildEchoVectors validates all embeddings before any Vectorize request', async () => {
  const fetchStub = createFetchStub((url, options, calls) => {
    assert.match(url, /\/embeddings$/);
    if (calls.length === 2) {
      return jsonResponse({ data: [] });
    }
    return jsonResponse({ data: [{ embedding: [0.1, 0.2, 0.3] }] });
  });

  await assert.rejects(
    buildEchoVectors([
      {
        id: 'public-0',
        title: 'Public',
        path: '/2026/07/04/public/',
        text: '第一段公开正文',
        chunkIndex: 0
      },
      {
        id: 'public-1',
        title: 'Public',
        path: '/2026/07/04/public/',
        text: '第二段公开正文',
        chunkIndex: 1
      }
    ], remoteEnv(), { fetchImpl: fetchStub }),
    /ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE/
  );

  assert.equal(fetchStub.calls.length, 2);
  assert.equal(fetchStub.calls.some(call => call.url.includes('/vectorize/')), false);
});

test('createEmbedding preserves synchronous fetch stub errors', async () => {
  await assert.rejects(
    createEmbedding('公开正文', remoteEnv(), {
      fetchImpl: () => {
        throw new Error('programmer bug');
      }
    }),
    /programmer bug/
  );
});

test('createEmbedding reports missing fetch without rewriting it as a network error', async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'fetch');
  try {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      writable: true,
      value: undefined
    });

    await assert.rejects(
      createEmbedding('公开正文', remoteEnv()),
      /ECHO_FETCH_MISSING/
    );
  } finally {
    if (descriptor) {
      Object.defineProperty(globalThis, 'fetch', descriptor);
    } else {
      delete globalThis.fetch;
    }
  }
});

test('createEmbedding maps rejected fetch calls to provider network errors', async () => {
  await assert.rejects(
    createEmbedding('公开正文', remoteEnv(), {
      fetchImpl: () => Promise.reject(new Error('ECONNRESET'))
    }),
    /ECHO_PROVIDER_NETWORK_ERROR/
  );
});

test('Vectorize upsert uses v2 URL, POST FormData vectors field, and NDJSON vectors', async () => {
  const fetchStub = createFetchStub(() => jsonResponse({ success: true, count: 1 }));
  const vector = {
    id: 'public-0',
    values: [0.1, 0.2, 0.3],
    metadata: {
      title: 'Public',
      path: '/2026/07/04/public/',
      text: '公开正文',
      chunkIndex: 0
    }
  };

  await upsertVectorizeVectors([vector], remoteEnv(), { fetchImpl: fetchStub });

  assert.equal(fetchStub.calls.length, 1);
  assert.equal(
    fetchStub.calls[0].url,
    'https://api.cloudflare.com/client/v4/accounts/account-id/vectorize/v2/indexes/echo-index/upsert'
  );
  assert.equal(fetchStub.calls[0].options.method, 'POST');
  assert.equal(fetchStub.calls[0].options.headers.authorization, 'Bearer cf-token');
  assert.equal('content-type' in fetchStub.calls[0].options.headers, false);
  assert.ok(fetchStub.calls[0].options.body instanceof FormData);

  const file = fetchStub.calls[0].options.body.get('vectors');
  assert.ok(file instanceof Blob);
  assert.equal(file.name, 'vectors.ndjson');
  assert.equal(file.type, 'application/x-ndjson');

  const ndjson = await file.text();
  assert.deepEqual(ndjson.trim().split('\n').map(line => JSON.parse(line)), [vector]);
  assert.equal(fetchStub.calls.some(call => call.options.method === 'DELETE'), false);
});

test('package scripts run the Echo indexer after static builds without requiring local secrets', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.equal(
    packageJson.scripts.build,
    'TZ=Asia/Shanghai ./tools/hexo-env.sh clean && TZ=Asia/Shanghai ./tools/hexo-env.sh generate'
  );
  assert.equal(packageJson.scripts['echo:index'], 'node tools/echo/build-index.mjs');
  assert.equal(packageJson.scripts.postbuild, 'node tools/echo/build-index.mjs');
});

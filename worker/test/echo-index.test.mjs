import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createWorkersAi() {
  const calls = [];
  return {
    calls,
    async run(model, input) {
      calls.push({ model, input });
      return {
        data: input.text.map((text, index) => [index + 0.1, text.length / 100])
      };
    }
  };
}

function createVectorize() {
  const calls = [];
  return {
    calls,
    async upsert(vectors) {
      calls.push(vectors);
      return { count: vectors.length };
    }
  };
}

const documents = [{
  id: 'now-and-before-0',
  title: '现在和从前',
  path: '/2026/07/12/now-and-before/',
  text: '我开始重新看待现在和从前。',
  chunkIndex: 0
}];

test('POST /echo-index rejects requests without the private index token', async () => {
  const ai = createWorkersAi();
  const vectorize = createVectorize();
  const response = await worker.fetch(new Request('https://visitor.example.com/echo-index', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ documents })
  }), {
    AI: ai,
    ECHO_VECTORIZE: vectorize,
    ECHO_INDEX_TOKEN: 'private-index-token'
  });

  assert.equal(response.status, 401);
  assert.equal(ai.calls.length, 0);
  assert.equal(vectorize.calls.length, 0);
});

test('POST /echo-index embeds and upserts published document metadata inside Cloudflare', async () => {
  const ai = createWorkersAi();
  const vectorize = createVectorize();
  const response = await worker.fetch(new Request('https://visitor.example.com/echo-index', {
    method: 'POST',
    headers: {
      authorization: 'Bearer private-index-token',
      'content-type': 'application/json'
    },
    body: JSON.stringify({ documents })
  }), {
    AI: ai,
    ECHO_VECTORIZE: vectorize,
    ECHO_INDEX_TOKEN: 'private-index-token'
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { indexed: 1 });
  assert.deepEqual(ai.calls, [{
    model: '@cf/baai/bge-m3',
    input: { text: ['现在和从前\n我开始重新看待现在和从前。'] }
  }]);
  assert.deepEqual(vectorize.calls[0], [{
    id: 'now-and-before-0',
    values: [0.1, 0.19],
    metadata: {
      title: '现在和从前',
      path: '/2026/07/12/now-and-before/',
      text: '我开始重新看待现在和从前。',
      chunkIndex: 0
    }
  }]);
});

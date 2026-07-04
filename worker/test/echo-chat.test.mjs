import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createEchoDb(firstResults = []) {
  const calls = [];

  function nextResult(method) {
    if (!firstResults.length) return method === 'all' ? [] : null;

    const result = firstResults.shift();
    if (result instanceof Error) throw result;

    if (method === 'all') {
      assert.ok(Array.isArray(result), 'Expected .all() result queue item to be an array');
    } else {
      assert.ok(result === null || (typeof result === 'object' && !Array.isArray(result)), 'Expected .first() result queue item to be an object or null');
    }

    return result;
  }

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
          return { results: nextResult('all') };
        },
        async first() {
          call.first = true;
          return nextResult('first');
        }
      };
    }
  };
}

function createVectorize() {
  const calls = [];

  return {
    calls,
    async query(vector, options) {
      calls.push({ vector, options });
      return {
        matches: [{
          id: 'post-a-0',
          score: 0.91,
          metadata: {
            title: '一个男孩写下了一篇博客',
            path: '/2026/07/04/a-boy-wrote-a-blog/',
            text: '一个男孩写下了一篇博客，这里先留给后来的故事。'
          }
        }]
      };
    }
  };
}

function createFetchStub() {
  const calls = [];
  const fetchStub = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/embeddings')) {
      return new Response(JSON.stringify({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 8 }
      }), { headers: { 'content-type': 'application/json' } });
    }

    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: '我想，他大概会先听你慢慢说完。'
        }
      }],
      usage: {
        prompt_tokens: 32,
        completion_tokens: 18
      }
    }), { headers: { 'content-type': 'application/json' } });
  };

  fetchStub.calls = calls;
  return fetchStub;
}

test('POST /echo-chat returns a writing-grounded reply and records no-content usage', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;

  try {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: {
        origin: 'https://lovezvv.com',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        message: '我最近有点迷茫',
        history: [{ role: 'assistant', content: '你可以慢慢说。' }]
      })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: vectorize,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_CHAT_MODEL: 'gpt-5.4-mini',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com',
      ECHO_EMBEDDING_MODEL: 'text-embedding-3-large'
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
    assert.deepEqual(await response.json(), {
      reply: '我想，他大概会先听你慢慢说完。',
      references: [{
        title: '一个男孩写下了一篇博客',
        path: '/2026/07/04/a-boy-wrote-a-blog/'
      }]
    });

    assert.equal(fetchStub.calls.length, 2);
    assert.match(fetchStub.calls[0].url, /\/embeddings$/);
    assert.match(fetchStub.calls[1].url, /\/chat\/completions$/);

    const embeddingPayload = JSON.parse(fetchStub.calls[0].options.body);
    assert.deepEqual(embeddingPayload, {
      model: 'text-embedding-3-large',
      input: '我最近有点迷茫'
    });
    assert.equal(fetchStub.calls[0].options.headers.authorization, 'Bearer embedding-key');

    assert.equal(vectorize.calls.length, 1);
    assert.deepEqual(vectorize.calls[0], {
      vector: [0.1, 0.2, 0.3],
      options: { topK: 5, returnMetadata: true }
    });

    const chatPayload = JSON.parse(fetchStub.calls[1].options.body);
    assert.equal(chatPayload.model, 'gpt-5.4-mini');
    assert.equal(fetchStub.calls[1].options.headers.authorization, 'Bearer chat-key');
    assert.match(chatPayload.messages[0].content, /你不是博客作者本人/);
    assert.match(chatPayload.messages[0].content, /不要假装拥有作者没有公开提到的私人记忆/);
    assert.match(chatPayload.messages[0].content, /这部分，他没有和我提起过，也许可以亲自去和他聊聊。/);
    assert.match(chatPayload.messages[0].content, /不要提供医疗、法律、金融/);
    assert.match(chatPayload.messages[0].content, /一个男孩写下了一篇博客/);
    assert.deepEqual(chatPayload.messages.at(-2), {
      role: 'assistant',
      content: '你可以慢慢说。'
    });
    assert.deepEqual(chatPayload.messages.at(-1), {
      role: 'user',
      content: '我最近有点迷茫'
    });

    const usageCall = db.calls.at(-1);
    assert.match(usageCall.sql, /INSERT INTO echo_usage_events/i);
    assert.doesNotMatch(usageCall.sql, /prompt_text|reply_text|conversation/i);
    assert.deepEqual(usageCall.values.slice(1), ['success', 40, 18, 1, null]);
    assert.ok(!usageCall.values.includes('我最近有点迷茫'));
    assert.ok(!usageCall.values.includes('我想，他大概会先听你慢慢说完。'));
    assert.ok(!usageCall.values.includes('你可以慢慢说。'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /echo-chat refuses when Echo is paused', async () => {
  const db = createEchoDb([{ setting_value: '0' }]);
  const fetchStub = createFetchStub();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;

  try {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '有人在吗' })
    }), { VISITOR_DB: db });

    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), {
      error: 'Echo is paused',
      message: '这阵回声暂时坐下来休息了。晚一点再来找他吧。'
    });
    assert.equal(fetchStub.calls.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('POST /echo-chat validates empty message before provider calls', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const fetchStub = createFetchStub();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;

  try {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '   ' })
    }), {
      VISITOR_DB: db,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com',
      ECHO_VECTORIZE: createVectorize()
    });

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: 'Message is required' });
    assert.equal(fetchStub.calls.length, 0);
    assert.equal(db.calls.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

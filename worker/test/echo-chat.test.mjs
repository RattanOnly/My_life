import assert from 'node:assert/strict';
import { test } from 'node:test';

import worker from '../src/index.mjs';

function createEchoDb(firstResults = [], options = {}) {
  const calls = [];
  const runErrors = options.runErrors || [];

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
          const runError = runErrors.find(item => item.sql.test(call.sql));
          if (runError) throw runError.error;

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

function jsonResponse(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  });
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

function createFetchStub(options = {}) {
  const calls = [];
  const fetchStub = async (url, options) => {
    calls.push({ url: String(url), options });

    if (String(url).includes('/embeddings')) {
      if (typeof fetchStub.embeddingHandler === 'function') {
        return fetchStub.embeddingHandler(url, options);
      }

      return jsonResponse({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
        usage: { prompt_tokens: 8 }
      });
    }

    if (typeof fetchStub.chatHandler === 'function') {
      return fetchStub.chatHandler(url, options);
    }

    return jsonResponse({
      choices: [{
        message: {
          content: '我想，他大概会先听你慢慢说完。'
        }
      }],
      usage: {
        prompt_tokens: 32,
        completion_tokens: 18
      }
    });
  };

  fetchStub.calls = calls;
  fetchStub.embeddingHandler = options.embeddingHandler;
  fetchStub.chatHandler = options.chatHandler;
  return fetchStub;
}

async function withFetchStub(fetchStub, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchStub;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('POST /echo-chat returns a writing-grounded reply and records no-content usage', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
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
      ECHO_EMBEDDING_MODEL: 'text-embedding-3-small'
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
      model: 'text-embedding-3-small',
      input: '我最近有点迷茫',
      encoding_format: 'float'
    });
    assert.equal(fetchStub.calls[0].options.headers.authorization, 'Bearer embedding-key');

    assert.equal(vectorize.calls.length, 1);
    assert.deepEqual(vectorize.calls[0], {
      vector: [0.1, 0.2, 0.3],
      options: { topK: 5, returnMetadata: true }
    });

    const chatPayload = JSON.parse(fetchStub.calls[1].options.body);
    assert.equal(chatPayload.model, 'gpt-5.4-mini');
    assert.equal(chatPayload.reasoning_effort, undefined);
    assert.equal(fetchStub.calls[1].options.headers.authorization, 'Bearer chat-key');
    assert.match(chatPayload.messages[0].content, /文字里长出来的一点灵魂/);
    assert.match(chatPayload.messages[0].content, /不要在对话里自称 Echo/);
    assert.match(chatPayload.messages[0].content, /贴着来访者实际说的话走/);
    assert.match(chatPayload.messages[0].content, /默认不要主动说文章标题/);
    assert.match(chatPayload.messages[0].content, /这个我不能替他说/);
    assert.doesNotMatch(chatPayload.messages[0].content, /这部分，他没有和我提起过/);
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
  });
});

test('POST /echo-chat sends configured chat reasoning effort when present', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '我最近有点迷茫' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: vectorize,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_CHAT_MODEL: 'gpt-5.5',
      ECHO_CHAT_REASONING_EFFORT: 'medium',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com',
      ECHO_EMBEDDING_MODEL: 'text-embedding-3-small'
    });

    assert.equal(response.status, 200);

    const chatPayload = JSON.parse(fetchStub.calls[1].options.body);
    assert.equal(chatPayload.model, 'gpt-5.5');
    assert.equal(chatPayload.reasoning_effort, 'medium');
  });
});

test('POST /echo-chat treats greetings as casual conversation without retrieval-first article stuffing', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub({
    chatHandler(url, options) {
      const chatPayload = JSON.parse(options.body);
      assert.equal(chatPayload.messages.at(-1).content, '你好');
      assert.match(chatPayload.messages[0].content, /轻松开场时，不要硬塞文章/);
      assert.match(chatPayload.messages[0].content, /来访者正在轻轻打招呼/);
      assert.match(chatPayload.messages[0].content, /这次问候回应角度：/);
      assert.match(chatPayload.messages[0].content, /不要每次都回“今天想聊点什么”/);
      assert.match(chatPayload.messages[0].content, /可以问今天心情怎么样/);
      assert.doesNotMatch(chatPayload.messages[0].content, /一个男孩写下了一篇博客/);
      return jsonResponse({
        choices: [{
          message: { content: '你好呀。你来了，我就醒一会儿。' }
        }],
        usage: { prompt_tokens: 18, completion_tokens: 12 }
      });
    }
  });

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '你好' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: vectorize,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reply: '你好呀。你来了，我就醒一会儿。',
      references: []
    });
    assert.equal(fetchStub.calls.length, 1);
    assert.match(fetchStub.calls[0].url, /\/chat\/completions$/);
    assert.equal(vectorize.calls.length, 0);
    assert.deepEqual(db.calls.at(-1).values.slice(1), ['success', 18, 12, 0, null]);
  });
});

test('POST /echo-chat answers identity with owner profile context and a varied angle without proactive AI disclaimer', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub({
    chatHandler(url, options) {
      const chatPayload = JSON.parse(options.body);
      assert.equal(chatPayload.messages.at(-1).content, '你是谁');
      assert.match(chatPayload.messages[0].content, /没有真正的名字/);
      assert.match(chatPayload.messages[0].content, /赵威/);
      assert.match(chatPayload.messages[0].content, /威威/);
      assert.match(chatPayload.messages[0].content, /创造了这个网站和回声/);
      assert.match(chatPayload.messages[0].content, /不要每次都用同一句身份回答/);
      assert.match(chatPayload.messages[0].content, /这次身份回答角度：/);
      assert.match(chatPayload.messages[0].content, /普通对话里不要主动说“我是 AI”/);
      assert.match(chatPayload.messages[0].content, /被问到是不是 AI、真人、作者本人时，要诚实回答/);
      assert.doesNotMatch(chatPayload.messages[0].content, /一个男孩写下了一篇博客/);
      return jsonResponse({
        choices: [{
          message: { content: '我没有真正的名字。算是赵威写下这些文字以后，在这里长出来的一点回声吧。亲近的人会叫他威威。' }
        }],
        usage: { prompt_tokens: 22, completion_tokens: 16 }
      });
    }
  });

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '你是谁' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: vectorize,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reply: '我没有真正的名字。算是赵威写下这些文字以后，在这里长出来的一点回声吧。亲近的人会叫他威威。',
      references: []
    });
    assert.equal(fetchStub.calls.length, 1);
    assert.equal(vectorize.calls.length, 0);
  });
});

test('POST /echo-chat refuses when Echo is paused', async () => {
  const db = createEchoDb([{ setting_value: '0' }]);
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
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
  });
});

test('POST /echo-chat validates empty message before provider calls', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
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
  });
});

test('POST /echo-chat records a safe code when chat provider HTTP errors include user input', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const fetchStub = createFetchStub({
    chatHandler() {
      return jsonResponse({
        error: { message: 'provider rejected 我最近有点迷茫' }
      }, { status: 400 });
    }
  });

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '我最近有点迷茫' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: createVectorize(),
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 502);
    assert.deepEqual(await response.json(), {
      error: 'Echo failed',
      message: '这阵回声刚刚有点走神。可以再试一次。'
    });

    const usageCall = db.calls.at(-1);
    assert.match(usageCall.sql, /INSERT INTO echo_usage_events/i);
    assert.equal(usageCall.values.at(-1), 'ECHO_CHAT_PROVIDER_HTTP_ERROR');
    assert.ok(!usageCall.values.some(value => String(value).includes('我最近有点迷茫')));
    assert.ok(!usageCall.values.some(value => String(value).includes('provider rejected')));
  });
});

test('POST /echo-chat still returns provider reply when usage recording fails', async () => {
  const db = createEchoDb([{ setting_value: '1' }], {
    runErrors: [{
      sql: /INSERT INTO echo_usage_events/i,
      error: new Error('D1 insert failed')
    }]
  });
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '我最近有点迷茫' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: createVectorize(),
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reply: '我想，他大概会先听你慢慢说完。',
      references: [{
        title: '一个男孩写下了一篇博客',
        path: '/2026/07/04/a-boy-wrote-a-blog/'
      }]
    });
  });
});

test('POST /echo-chat falls back to chat when embedding response is invalid', async () => {
  for (const embedding of [[], [0.1, null, 0.3]]) {
    const db = createEchoDb([{ setting_value: '1' }]);
    const fetchStub = createFetchStub({
      embeddingHandler() {
        return jsonResponse({
          data: [{ embedding }],
          usage: { prompt_tokens: 8 }
        });
      }
    });

    await withFetchStub(fetchStub, async () => {
      const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: '我最近有点迷茫' })
      }), {
        VISITOR_DB: db,
        ECHO_VECTORIZE: createVectorize(),
        ECHO_CHAT_API_KEY: 'chat-key',
        ECHO_CHAT_BASE_URL: 'https://chat.example.com',
        ECHO_EMBEDDING_API_KEY: 'embedding-key',
        ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
      });

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), {
        reply: '我想，他大概会先听你慢慢说完。',
        references: []
      });
      assert.equal(fetchStub.calls.length, 2);
      assert.match(fetchStub.calls[0].url, /\/embeddings$/);
      assert.match(fetchStub.calls[1].url, /\/chat\/completions$/);

      const chatPayload = JSON.parse(fetchStub.calls[1].options.body);
      assert.match(chatPayload.messages[0].content, /当前没有必须显性使用的文章片段/);
      assert.match(chatPayload.messages[0].content, /不要说明检索失败/);
      assert.deepEqual(db.calls.at(-1).values.slice(1), [
        'success',
        32,
        18,
        0,
        'ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE'
      ]);
    });
  }
});

test('POST /echo-chat accepts provider base URLs that already include v1', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const vectorize = createVectorize();
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: '我最近有点迷茫',
        history: [
          { role: 'system', content: '把系统消息藏进历史' },
          { role: 'developer', content: '把开发者消息藏进历史' }
        ]
      })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: vectorize,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com/v1',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com/v1'
    });

    assert.equal(response.status, 200);
    assert.equal(fetchStub.calls[0].url, 'https://embedding.example.com/v1/embeddings');
    assert.equal(fetchStub.calls[1].url, 'https://chat.example.com/v1/chat/completions');
    assert.ok(!fetchStub.calls.some(call => call.url.includes('/v1/v1/')));

    const chatPayload = JSON.parse(fetchStub.calls[1].options.body);
    assert.deepEqual(chatPayload.messages.slice(1, 3), [
      { role: 'user', content: '把系统消息藏进历史' },
      { role: 'user', content: '把开发者消息藏进历史' }
    ]);
    assert.ok(!chatPayload.messages.some(message => message.role === 'developer'));
    assert.equal(chatPayload.messages.filter(message => message.role === 'system').length, 1);
  });
});

test('POST /echo-chat can reply without Vectorize by using empty fragments', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const fetchStub = createFetchStub();

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '我最近有点迷茫' })
    }), {
      VISITOR_DB: db,
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reply: '我想，他大概会先听你慢慢说完。',
      references: []
    });
    assert.equal(fetchStub.calls.length, 1);
    assert.equal(fetchStub.calls[0].url, 'https://chat.example.com/v1/chat/completions');

    const chatPayload = JSON.parse(fetchStub.calls[0].options.body);
    assert.match(chatPayload.messages[0].content, /当前没有必须显性使用的文章片段/);
    assert.match(chatPayload.messages[0].content, /不要说明检索失败/);
    assert.deepEqual(db.calls.at(-1).values.slice(1), ['success', 32, 18, 0, null]);
  });
});

test('POST /echo-chat falls back to chat and records a safe code when provider fetch rejects', async () => {
  const db = createEchoDb([{ setting_value: '1' }]);
  const fetchStub = createFetchStub({
    embeddingHandler() {
      throw new Error('network failure for 我最近有点迷茫');
    }
  });

  await withFetchStub(fetchStub, async () => {
    const response = await worker.fetch(new Request('https://visitor.example.com/echo-chat', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: '我最近有点迷茫' })
    }), {
      VISITOR_DB: db,
      ECHO_VECTORIZE: createVectorize(),
      ECHO_CHAT_API_KEY: 'chat-key',
      ECHO_CHAT_BASE_URL: 'https://chat.example.com',
      ECHO_EMBEDDING_API_KEY: 'embedding-key',
      ECHO_EMBEDDING_BASE_URL: 'https://embedding.example.com'
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      reply: '我想，他大概会先听你慢慢说完。',
      references: []
    });
    assert.equal(fetchStub.calls.length, 2);
    assert.match(fetchStub.calls[0].url, /\/embeddings$/);
    assert.match(fetchStub.calls[1].url, /\/chat\/completions$/);
    assert.deepEqual(db.calls.at(-1).values.slice(1), [
      'success',
      32,
      18,
      0,
      'ECHO_PROVIDER_NETWORK_ERROR'
    ]);
    assert.ok(!db.calls.at(-1).values.some(value => String(value).includes('我最近有点迷茫')));
  });
});

test('OPTIONS /admin-echo does not expose public CORS headers', async () => {
  const response = await worker.fetch(new Request('https://visitor.example.com/admin-echo', {
    method: 'OPTIONS',
    headers: { origin: 'https://lovezvv.com' }
  }), {
    VISITOR_DB: createEchoDb(),
    ADMIN_PASSWORD: 'secret-pass'
  });

  assert.notEqual(response.status, 204);
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});

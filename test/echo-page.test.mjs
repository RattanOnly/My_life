import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const echoScriptUrl = new URL('../source/js/echo-chat.js', import.meta.url);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.focused = false;
    this.listeners = new Map();
    this.selectorMap = new Map();
    this.textContent = '';
    this.value = '';
  }

  addEventListener(type, handler) {
    this.listeners.set(type, handler);
  }

  append(child) {
    child.parentNode = this;
    this.children.push(child);
  }

  dispatch(type) {
    const handler = this.listeners.get(type);
    if (!handler) return;
    handler({
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true;
      }
    });
  }

  focus() {
    this.focused = true;
    this.dispatch('focus');
  }

  remove() {
    if (!this.parentNode) return;
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }

  querySelector(selector) {
    return this.selectorMap.get(selector) || null;
  }
}

const createResponse = payload => {
  const isResponseShape = Object.hasOwn(payload, 'ok') || Object.hasOwn(payload, 'status') || Object.hasOwn(payload, 'body');
  const status = isResponseShape ? payload.status || 200 : 200;
  const ok = isResponseShape ? payload.ok ?? status < 400 : true;
  const body = isResponseShape ? payload.body ?? {} : payload;

  return {
    ok,
    status,
    async json() {
      return body;
    }
  };
};

const settleAsyncWork = async () => {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
};

const createEchoRuntime = ({
  statusResponses = [{ enabled: true }],
  chatResponses = [],
  location,
  characterFactory
} = {}) => {
  const root = new FakeElement('root');
  const form = new FakeElement('form');
  const messages = new FakeElement('messages');
  const status = new FakeElement('status');
  const textarea = new FakeElement('textarea');
  const button = new FakeElement('button');
  const calls = [];
  const characterCalls = [];
  const characterAdapter = {
    ready: Promise.resolve(true),
    playEntrance() {
      characterCalls.push({ type: 'playEntrance' });
    },
    setState(stage) {
      characterCalls.push({ type: 'setState', stage });
    },
    destroy() {
      characterCalls.push({ type: 'destroy' });
    }
  };

  root.dataset.echoChatEndpoint = '/unit-chat';
  root.dataset.echoStatusEndpoint = '/unit-status';
  root.dataset.echoStage = 'idle';
  root.selectorMap.set('[data-echo-form]', form);
  root.selectorMap.set('[data-echo-messages]', messages);
  root.selectorMap.set('[data-echo-status]', status);
  form.selectorMap.set('[name="message"]', textarea);
  form.selectorMap.set('[data-echo-submit]', button);

  const statusQueue = [...statusResponses];
  const chatQueue = [...chatResponses];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });
    const route = String(url).replace('http://localhost:8787', '');

    if (route === '/unit-status') {
      return createResponse(await (statusQueue.length ? statusQueue.shift() : { enabled: true }));
    }

    if (route === '/unit-chat') {
      return createResponse(await (chatQueue.length ? chatQueue.shift() : { reply: '默认回声' }));
    }

    return createResponse({ ok: false, status: 404, body: {} });
  };

  const createCharacter =
    characterFactory ||
    (targetRoot => {
      characterCalls.push({ type: 'create', root: targetRoot });
      return characterAdapter;
    });
  const context = createContext({
    document: {
      createElement: tagName => new FakeElement(tagName),
      getElementById: id => (id === 'echo-page' ? root : null)
    },
    EchoCharacter: {
      create(targetRoot) {
        return createCharacter(targetRoot);
      }
    },
    fetch,
    location
  });

  return {
    button,
    calls,
    characterCalls,
    context,
    form,
    messages,
    root,
    status,
    textarea
  };
};

const runEchoScript = async runtime => {
  const script = await readFile(echoScriptUrl, 'utf8');
  runInContext(script, runtime.context, { filename: 'echo-chat.js' });
  await settleAsyncWork();
};

test('Echo page renders a standalone AI conversation shell', async () => {
  const page = await readFile(new URL('../source/echo/index.md', import.meta.url), 'utf8');

  assert.match(page, /title:\s*Echo/);
  assert.match(page, /type:\s*echo/);
  assert.match(page, /header:\s*false/);
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="echo-page"/);
  assert.match(page, /data-echo-chat-endpoint="\/echo-chat"/);
  assert.match(page, /data-echo-status-endpoint="\/echo-status"/);
  assert.match(page, /data-echo-stage="idle"/);
  assert.match(page, /我不是他本人，只是这些文字里慢慢长出来的一点回声。你可以安心说，话会停在这次相遇里，不会被拿去给人翻看。/);
  assert.doesNotMatch(page, /这里不是他本人，只是一些从他的文字里长出来的回声。你的对话不会被保存。/);
  assert.match(page, /data-echo-character/);
  assert.match(page, /data-echo-character-fallback/);
  assert.match(page, /src="\/echo\/assets\/echo-boy-fallback\.svg"/);
  const legacyRuntimePattern = new RegExp([
    'r' + 'ive',
    '\\.' + 'r' + 'iv',
    'data-echo-' + 'r' + 'ive',
    'echo-character-' + 'canvas'
  ].join('|'), 'i');
  assert.doesNotMatch(page, legacyRuntimePattern);
  assert.match(page, /data-echo-messages/);
  assert.match(page, /<form[^>]*data-echo-form[^>]*onsubmit="return false"[^>]*>/);
  assert.match(page, /name="message"/);
  assert.match(page, /<button[^>]*type="submit"[^>]*data-echo-submit[^>]*>发送<\/button>/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /\/js\/echo-character\.js/);
  assert.match(page, /\/js\/echo-chat\.js/);
  assert.doesNotMatch(page, /class="echo-boy"/);
});

test('NexT page template can hide page headers for focused custom pages', async () => {
  const template = await readFile(new URL('../themes/next/layout/page.swig', import.meta.url), 'utf8');

  assert.match(template, /page\.header\s*!==\s*false/);
  assert.match(template, /include '_partials\/page\/page-header\.swig'/);
});

test('Echo frontend keeps initializing and loading status when character creation throws', async () => {
  const runtime = createEchoRuntime({
    statusResponses: [{ enabled: false }],
    characterFactory() {
      throw new Error('character unavailable');
    }
  });

  await assert.doesNotReject(() => runEchoScript(runtime));

  assert.equal(runtime.root.dataset.initialized, 'true');
  assert.equal(runtime.calls[0].url, '/unit-status');
  assert.equal(runtime.root.dataset.echoStage, 'disabled');
  assert.equal(runtime.textarea.disabled, true);
  assert.match(runtime.status.textContent, /这阵回声暂时坐下来休息了/);
});

test('Echo frontend falls back when character creation returns null or a bad adapter', async () => {
  for (const characterResult of [null, { setState: 'not a function' }]) {
    const runtime = createEchoRuntime({
      chatResponses: [{ reply: '还在这里' }],
      characterFactory() {
        return characterResult;
      }
    });

    await assert.doesNotReject(() => runEchoScript(runtime));

    runtime.textarea.value = '能说话吗';
    runtime.form.dispatch('submit');
    await settleAsyncWork();

    assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
    assert.equal(runtime.messages.children[1].textContent, '还在这里');
    assert.equal(runtime.textarea.disabled, false);
  }
});

test('Echo frontend isolates character play and state failures from chat behavior', async () => {
  const entranceFailure = createEchoRuntime({
    statusResponses: [{ enabled: false }],
    characterFactory() {
      return {
        ready: Promise.resolve(false),
        playEntrance() {
          throw new Error('entrance failed');
        },
        setState() {},
        destroy() {}
      };
    }
  });

  await assert.doesNotReject(() => runEchoScript(entranceFailure));
  assert.equal(entranceFailure.root.dataset.echoStage, 'disabled');
  assert.equal(entranceFailure.textarea.disabled, true);

  const stateFailure = createEchoRuntime({
    chatResponses: [{ reply: '状态坏了也能回声' }],
    characterFactory() {
      return {
        ready: Promise.resolve(true),
        playEntrance() {},
        setState() {
          throw new Error('state failed');
        },
        destroy() {}
      };
    }
  });

  await assert.doesNotReject(() => runEchoScript(stateFailure));

  stateFailure.textarea.value = '继续吗';
  stateFailure.form.dispatch('submit');
  await settleAsyncWork();

  assert.equal(stateFailure.root.dataset.echoStage, 'reply_ready');
  assert.equal(stateFailure.messages.children[1].textContent, '状态坏了也能回声');
  assert.equal(stateFailure.textarea.disabled, false);
});

test('Echo is available from the main navigation', async () => {
  const config = await readFile(new URL('../themes/next/_config.yml', import.meta.url), 'utf8');

  assert.match(config, /menu:\n(?:.*\n)*?\s+回声:\s+\/echo\/\s+\|\|\s+fa fa-comment-dots/);
});

test('Echo styles define hand-drawn layout and reduced motion behavior', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.echo-page/);
  assert.match(styles, /\.echo-character/);
  assert.match(styles, /\.echo-character\s*\{(?:[^{}]|\n)*z-index:\s*3/);
  assert.match(styles, /\.echo-chat-panel\s*\{(?:[^{}]|\n)*z-index:\s*1/);
  assert.match(styles, /\.echo-character-fallback/);
  assert.match(styles, /\.post-body\s+\.echo-character-fallback\s*\{[\s\S]*max-width:\s*none[\s\S]*max-height:\s*none[\s\S]*margin:\s*0/);
  const legacyRuntimePattern = new RegExp([
    'r' + 'ive',
    'echo-character-' + 'canvas'
  ].join('|'), 'i');
  assert.doesNotMatch(styles, legacyRuntimePattern);
  assert.match(styles, /\.echo-page\[data-echo-stage='thinking'\]\s+\.echo-character-fallback/);
  assert.match(styles, /\.echo-belt/);
  assert.match(styles, /\.echo-message-thinking/);
  assert.match(styles, /@keyframes echo-character-breathe/);
  assert.match(styles, /@keyframes echo-character-think/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation:\s*none/);
  assert.doesNotMatch(styles, /\.echo-boy/);
});

test('Echo frontend does not use localStorage or sessionStorage for conversations', async () => {
  const script = await readFile(echoScriptUrl, 'utf8');

  assert.doesNotMatch(script, /localStorage/);
  assert.doesNotMatch(script, /sessionStorage/);
  assert.doesNotMatch(script, /indexedDB/);
});

test('Echo frontend posts only active page-session messages and handles disabled state', async () => {
  const script = await readFile(echoScriptUrl, 'utf8');

  assert.match(script, /chatEndpoint/);
  assert.match(script, /statusEndpoint/);
  assert.match(script, /fetch\(chatEndpoint/);
  assert.match(script, /history\.slice\(-6\)/);
  assert.match(script, /我在想一想\.\.\./);
  assert.match(script, /appendMessage\('assistant', '我在想一想\.\.\.', 'thinking'\)/);
  assert.match(script, /这阵回声暂时坐下来休息了/);
  assert.match(script, /setStage\('thinking'\)/);
  assert.match(script, /setStage\('reply_ready'\)/);
  assert.match(script, /'listening'/);
  assert.match(script, /setStage\('idle'\)/);
  assert.doesNotMatch(script, /idle_sit|walk/);
  assert.match(script, /credentials:\s*'omit'/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB/);
});

test('Echo frontend loads public status without credentials', async () => {
  const runtime = createEchoRuntime();

  await runEchoScript(runtime);

  assert.equal(runtime.calls[0].url, '/unit-status');
  assert.equal(runtime.calls[0].options.credentials, 'omit');
  assert.equal(runtime.calls[0].options.cache, 'no-store');
  assert.equal(runtime.characterCalls[0].type, 'create');
  assert.equal(runtime.characterCalls[0].root, runtime.root);
  assert.deepEqual(runtime.characterCalls.slice(1, 3), [
    { type: 'playEntrance' },
    { type: 'setState', stage: 'idle' }
  ]);
});

test('Echo frontend points localhost static preview to the local Worker', async () => {
  const runtime = createEchoRuntime({
    location: {
      hostname: 'localhost',
      port: '4000'
    }
  });

  await runEchoScript(runtime);

  assert.equal(runtime.calls[0].url, 'http://localhost:8787/unit-status');
});

test('Echo frontend disables input when public status is disabled', async () => {
  const runtime = createEchoRuntime({
    statusResponses: [{ enabled: false }]
  });

  await runEchoScript(runtime);

  assert.equal(runtime.textarea.disabled, true);
  assert.equal(runtime.button.disabled, true);
  assert.equal(runtime.root.dataset.echoStage, 'disabled');
  assert.match(runtime.status.textContent, /这阵回声暂时坐下来休息了/);
});

test('Echo frontend maps input focus and blur to idle or listening states', async () => {
  const runtime = createEchoRuntime();

  await runEchoScript(runtime);

  runtime.textarea.value = '';
  runtime.textarea.dispatch('focus');
  assert.equal(runtime.root.dataset.echoStage, 'idle');

  runtime.textarea.value = '有话要说';
  runtime.textarea.dispatch('focus');
  assert.equal(runtime.root.dataset.echoStage, 'listening');

  runtime.textarea.dispatch('blur');
  assert.equal(runtime.root.dataset.echoStage, 'listening');

  runtime.textarea.value = '';
  runtime.textarea.dispatch('blur');
  assert.equal(runtime.root.dataset.echoStage, 'idle');
  assert.deepEqual(
    runtime.characterCalls.filter(call => call.type === 'setState').map(call => call.stage),
    ['idle', 'listening', 'idle']
  );
});

test('Echo frontend does not send duplicate character states for repeated input events', async () => {
  const runtime = createEchoRuntime();

  await runEchoScript(runtime);

  runtime.textarea.value = '慢慢说';
  runtime.textarea.dispatch('focus');
  runtime.textarea.dispatch('input');
  runtime.textarea.dispatch('input');
  runtime.textarea.dispatch('focus');

  assert.equal(runtime.root.dataset.echoStage, 'listening');
  assert.deepEqual(
    runtime.characterCalls.filter(call => call.type === 'setState').map(call => call.stage),
    ['idle', 'listening']
  );
});

test('Echo frontend submits messages with previous page-session history only', async () => {
  const runtime = createEchoRuntime({
    chatResponses: [{ reply: '第一轮回答' }, { reply: '第二轮回答' }]
  });

  await runEchoScript(runtime);

  runtime.textarea.value = '第一句';
  runtime.textarea.dispatch('input');
  assert.equal(runtime.root.dataset.echoStage, 'listening');
  runtime.form.dispatch('submit');
  await settleAsyncWork();

  const firstChatCall = runtime.calls[1];
  assert.equal(firstChatCall.url, '/unit-chat');
  assert.equal(firstChatCall.options.method, 'POST');
  assert.equal(firstChatCall.options.credentials, 'omit');
  assert.deepEqual(JSON.parse(firstChatCall.options.body), {
    message: '第一句',
    history: []
  });
  assert.equal(runtime.messages.children.length, 2);
  assert.equal(runtime.messages.children[0].className, 'echo-message echo-message-user');
  assert.equal(runtime.messages.children[0].textContent, '第一句');
  assert.equal(runtime.messages.children[1].className, 'echo-message echo-message-assistant');
  assert.equal(runtime.messages.children[1].textContent, '第一轮回答');
  assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
  assert.equal(runtime.textarea.disabled, false);
  assert.equal(runtime.button.disabled, false);
  assert.equal(runtime.textarea.focused, true);

  runtime.textarea.value = '第二句';
  runtime.textarea.dispatch('input');
  runtime.form.dispatch('submit');
  await settleAsyncWork();

  const secondBody = JSON.parse(runtime.calls[2].options.body);
  assert.equal(secondBody.message, '第二句');
  assert.deepEqual(secondBody.history, [
    { role: 'user', content: '第一句' },
    { role: 'assistant', content: '第一轮回答' }
  ]);
  assert.equal(secondBody.history.some(item => item.content === '第二句'), false);
  assert.equal(runtime.messages.children.length, 4);
  assert.equal(runtime.messages.children[3].textContent, '第二轮回答');
  assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
  assert.deepEqual(
    runtime.characterCalls.filter(call => call.type === 'setState').map(call => call.stage),
    ['idle', 'listening', 'thinking', 'reply_ready', 'listening', 'thinking', 'reply_ready']
  );
});

test('Echo frontend sends messages from the send button', async () => {
  const runtime = createEchoRuntime({
    chatResponses: [{ reply: '按钮回答' }]
  });

  await runEchoScript(runtime);

  runtime.textarea.value = '你好';
  runtime.button.dispatch('click');
  await settleAsyncWork();

  const chatCall = runtime.calls[1];
  assert.equal(chatCall.url, '/unit-chat');
  assert.equal(chatCall.options.method, 'POST');
  assert.deepEqual(JSON.parse(chatCall.options.body), {
    message: '你好',
    history: []
  });
  assert.equal(runtime.messages.children[0].textContent, '你好');
  assert.equal(runtime.messages.children[1].textContent, '按钮回答');
  assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
});

test('Echo frontend does not insert idle character state when focusing after a successful reply', async () => {
  const runtime = createEchoRuntime({
    chatResponses: [{ reply: '第一轮回答' }]
  });

  await runEchoScript(runtime);

  runtime.textarea.value = '第一句';
  runtime.textarea.dispatch('input');
  runtime.form.dispatch('submit');
  await settleAsyncWork();

  const states = runtime.characterCalls.filter(call => call.type === 'setState').map(call => call.stage);
  assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
  assert.equal(runtime.textarea.focused, true);
  assert.deepEqual(states, ['idle', 'listening', 'thinking', 'reply_ready']);

  const statePath = states.join(' -> ');
  assert.doesNotMatch(statePath, /thinking -> idle -> reply_ready/);
  assert.doesNotMatch(statePath, /reply_ready -> idle/);
});

test('Echo frontend shows a transient thinking bubble while waiting for a reply', async () => {
  let resolveReply;
  const replyPromise = new Promise(resolve => {
    resolveReply = resolve;
  });
  const runtime = createEchoRuntime({
    chatResponses: [replyPromise]
  });

  await runEchoScript(runtime);

  runtime.textarea.value = '你还在吗';
  runtime.form.dispatch('submit');
  await settleAsyncWork();

  assert.equal(runtime.root.dataset.echoStage, 'thinking');
  assert.equal(runtime.textarea.disabled, true);
  assert.equal(runtime.button.disabled, true);
  assert.equal(runtime.status.textContent, '');
  assert.equal(runtime.messages.children.length, 2);
  assert.equal(runtime.messages.children[0].className, 'echo-message echo-message-user');
  assert.equal(runtime.messages.children[1].className, 'echo-message echo-message-assistant echo-message-thinking');
  assert.equal(runtime.messages.children[1].textContent, '我在想一想...');

  resolveReply({ reply: '我在。' });
  await settleAsyncWork();

  assert.equal(runtime.messages.children.length, 2);
  assert.equal(runtime.messages.children[1].className, 'echo-message echo-message-assistant');
  assert.equal(runtime.messages.children[1].textContent, '我在。');
  assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
});

test('Echo frontend recovers from 502 but keeps 503 disabled', async () => {
  const ordinaryFailure = createEchoRuntime({
    chatResponses: [{ ok: false, status: 502, body: {} }]
  });

  await runEchoScript(ordinaryFailure);
  ordinaryFailure.textarea.value = '失败测试';
  ordinaryFailure.form.dispatch('submit');
  await settleAsyncWork();

  assert.equal(ordinaryFailure.root.dataset.echoStage, 'idle');
  assert.equal(ordinaryFailure.textarea.disabled, false);
  assert.equal(ordinaryFailure.button.disabled, false);
  assert.equal(ordinaryFailure.messages.children.length, 1);
  assert.equal(ordinaryFailure.messages.children[0].className, 'echo-message echo-message-user');
  assert.match(ordinaryFailure.status.textContent, /这阵回声刚刚有点走神。可以再试一次。/);

  const disabledFailure = createEchoRuntime({
    chatResponses: [{ ok: false, status: 503, body: {} }]
  });

  await runEchoScript(disabledFailure);
  disabledFailure.textarea.value = '暂停测试';
  disabledFailure.form.dispatch('submit');
  await settleAsyncWork();

  assert.equal(disabledFailure.root.dataset.echoStage, 'disabled');
  assert.equal(disabledFailure.textarea.disabled, true);
  assert.equal(disabledFailure.button.disabled, true);
  assert.equal(disabledFailure.messages.children.length, 1);
  assert.equal(disabledFailure.messages.children[0].className, 'echo-message echo-message-user');
  assert.match(disabledFailure.status.textContent, /这阵回声暂时坐下来休息了/);
});

test('Echo character scaling and message text wrapping are resilient', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(
    styles,
    /\.echo-character\s*\{[\s\S]*width:\s*clamp\(118px,\s*22vw,\s*172px\)[\s\S]*aspect-ratio:\s*1\s*\/\s*1\.32/
  );
  assert.match(
    styles,
    /@media \(max-width:\s*700px\)\s*\{[\s\S]*\.echo-character\s*\{[\s\S]*width:\s*clamp\(96px,\s*32vw,\s*132px\)/
  );
  assert.match(
    styles,
    /\.echo-message\s*\{[\s\S]*overflow-wrap:\s*anywhere[\s\S]*white-space:\s*pre-wrap[\s\S]*min-width:\s*0/
  );
});

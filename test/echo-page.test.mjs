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

const createEchoRuntime = ({ statusResponses = [{ enabled: true }], chatResponses = [] } = {}) => {
  const root = new FakeElement('root');
  const form = new FakeElement('form');
  const messages = new FakeElement('messages');
  const status = new FakeElement('status');
  const textarea = new FakeElement('textarea');
  const button = new FakeElement('button');
  const calls = [];

  root.dataset.echoChatEndpoint = '/unit-chat';
  root.dataset.echoStatusEndpoint = '/unit-status';
  root.dataset.echoStage = 'idle_sit';
  root.selectorMap.set('[data-echo-form]', form);
  root.selectorMap.set('[data-echo-messages]', messages);
  root.selectorMap.set('[data-echo-status]', status);
  form.selectorMap.set('[name="message"]', textarea);
  form.selectorMap.set('button[type="submit"]', button);

  const statusQueue = [...statusResponses];
  const chatQueue = [...chatResponses];
  const fetch = async (url, options = {}) => {
    calls.push({ url, options });

    if (url === '/unit-status') {
      return createResponse(statusQueue.shift() || { enabled: true });
    }

    if (url === '/unit-chat') {
      return createResponse(chatQueue.shift() || { reply: '默认回声' });
    }

    return createResponse({ ok: false, status: 404, body: {} });
  };

  const context = createContext({
    document: {
      createElement: tagName => new FakeElement(tagName),
      getElementById: id => (id === 'echo-page' ? root : null)
    },
    fetch
  });

  return {
    button,
    calls,
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
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="echo-page"/);
  assert.match(page, /data-echo-chat-endpoint="\/echo-chat"/);
  assert.match(page, /data-echo-status-endpoint="\/echo-status"/);
  assert.match(page, /data-echo-stage="idle_sit"/);
  assert.match(page, /这里不是他本人，只是一些从他的文字里长出来的回声。你的对话不会被保存。/);
  assert.match(page, /data-echo-messages/);
  assert.match(page, /data-echo-form/);
  assert.match(page, /name="message"/);
  assert.match(page, /aria-live="polite"/);
  assert.match(page, /\/js\/echo-chat\.js/);
});

test('Echo is available from the main navigation', async () => {
  const config = await readFile(new URL('../themes/next/_config.yml', import.meta.url), 'utf8');

  assert.match(config, /menu:\n(?:.*\n)*?\s+Echo:\s+\/echo\/\s+\|\|\s+fa fa-comment-dots/);
});

test('Echo styles define hand-drawn layout and reduced motion behavior', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.echo-page/);
  assert.match(styles, /\.echo-boy/);
  assert.match(styles, /\.echo-belt/);
  assert.match(styles, /prefers-reduced-motion:\s*reduce/);
  assert.match(styles, /animation:\s*none/);
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
  assert.match(script, /Echo 正在想一想。/);
  assert.match(script, /这阵回声暂时坐下来休息了/);
  assert.match(script, /setStage\('thinking'\)/);
  assert.match(script, /setStage\('reply_ready'\)/);
  assert.match(script, /credentials:\s*'omit'/);
  assert.doesNotMatch(script, /localStorage|sessionStorage|indexedDB/);
});

test('Echo frontend loads public status without credentials', async () => {
  const runtime = createEchoRuntime();

  await runEchoScript(runtime);

  assert.equal(runtime.calls[0].url, '/unit-status');
  assert.equal(runtime.calls[0].options.credentials, 'omit');
  assert.equal(runtime.calls[0].options.cache, 'no-store');
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

test('Echo frontend submits messages with previous page-session history only', async () => {
  const runtime = createEchoRuntime({
    chatResponses: [{ reply: '第一轮回答' }, { reply: '第二轮回答' }]
  });

  await runEchoScript(runtime);

  runtime.textarea.value = '第一句';
  runtime.textarea.dispatch('input');
  assert.equal(runtime.root.dataset.echoStage, 'walk');
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
});

test('Echo frontend recovers from 502 but keeps 503 disabled', async () => {
  const ordinaryFailure = createEchoRuntime({
    chatResponses: [{ ok: false, status: 502, body: {} }]
  });

  await runEchoScript(ordinaryFailure);
  ordinaryFailure.textarea.value = '失败测试';
  ordinaryFailure.form.dispatch('submit');
  await settleAsyncWork();

  assert.equal(ordinaryFailure.root.dataset.echoStage, 'idle_sit');
  assert.equal(ordinaryFailure.textarea.disabled, false);
  assert.equal(ordinaryFailure.button.disabled, false);
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
  assert.match(disabledFailure.status.textContent, /这阵回声暂时坐下来休息了/);
});

test('Echo character scaling and message text wrapping are resilient', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /--echo-boy-scale:\s*1/);
  assert.match(styles, /--echo-boy-scale:\s*\.82/);
  assert.match(styles, /@keyframes echo-boy-walk[\s\S]*scale\(var\(--echo-boy-scale\)\)/);
  assert.match(
    styles,
    /\.echo-message\s*\{[\s\S]*overflow-wrap:\s*anywhere[\s\S]*white-space:\s*pre-wrap[\s\S]*min-width:\s*0/
  );
});

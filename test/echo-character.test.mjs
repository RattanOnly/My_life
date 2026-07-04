import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const characterScriptUrl = new URL('../source/js/echo-character.js', import.meta.url);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.attributes = new Map();
    this.dataset = {};
    this.selectorMap = new Map();
    this.children = [];
    this.width = 320;
    this.height = 240;
  }

  getAttribute(name) {
    return this.attributes.get(name) || null;
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
  }

  querySelector(selector) {
    return this.selectorMap.get(selector) || null;
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }
}

const loadCharacterApi = async extraContext => {
  const context = createContext({
    console: { warn() {} },
    setTimeout,
    clearTimeout,
    queueMicrotask,
    ...extraContext
  });
  const script = await readFile(characterScriptUrl, 'utf8');
  runInContext(script, context, { filename: 'echo-character.js' });
  return context.EchoCharacter;
};

const createRoot = () => {
  const root = new FakeElement('root');
  const shell = new FakeElement('shell');
  const canvas = new FakeElement('canvas');
  const fallback = new FakeElement('fallback');
  shell.dataset.echoRiveSrc = '/echo/assets/echo-boy.riv';
  shell.selectorMap.set('[data-echo-rive-canvas]', canvas);
  shell.selectorMap.set('[data-echo-character-fallback]', fallback);
  root.selectorMap.set('[data-echo-character]', shell);
  return { root, shell, canvas, fallback };
};

test('falls back when Rive loading fails and keeps state on the shell', async () => {
  const EchoCharacter = await loadCharacterApi();
  const { root, shell, fallback } = createRoot();

  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => {
      throw new Error('rive unavailable');
    }
  }).create(root);

  assert.equal(await adapter.ready, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');

  adapter.setState('thinking');
  assert.equal(shell.dataset.echoCharacterState, 'thinking');
  assert.equal(fallback.dataset.echoCharacterState, 'thinking');

  adapter.playEntrance();
  assert.equal(shell.dataset.echoCharacterEntered, 'true');
});

test('maps semantic states to fake Rive state machine inputs', async () => {
  const enter = { fired: 0, fire() { this.fired += 1; } };
  const attention = { fired: 0, fire() { this.fired += 1; } };
  const mode = { name: 'mode', value: -1 };
  const reducedMotion = { name: 'reducedMotion', value: true };
  const calls = {
    stateMachineInputs: [],
    resizeDrawingSurfaceToCanvas: 0,
    cleanup: 0,
    src: null
  };
  class FakeRive {
    constructor(options) {
      calls.src = options.src;
    }

    stateMachineInputs(name) {
      calls.stateMachineInputs.push(name);
      return [mode, enter, attention, reducedMotion];
    }

    resizeDrawingSurfaceToCanvas() {
      calls.resizeDrawingSurfaceToCanvas += 1;
    }

    cleanup() {
      calls.cleanup += 1;
    }
  }

  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: { setWasmUrl(url) { calls.wasmUrl = url; }, setFallbackUrl(url) { calls.fallbackUrl = url; } },
      Layout: class {},
      Fit: { Contain: 'contain' },
      Alignment: { Center: 'center' }
    })
  }).create(root);

  assert.equal(await adapter.ready, true);
  assert.equal(calls.src, '/echo/assets/echo-boy.riv');
  assert.deepEqual(calls.stateMachineInputs, ['EchoBoyState']);
  assert.equal(calls.resizeDrawingSurfaceToCanvas, 1);
  assert.equal(calls.wasmUrl, '/vendor/rive/rive.wasm');
  assert.equal(calls.fallbackUrl, '/vendor/rive/rive_fallback.wasm');
  assert.equal(shell.dataset.echoCharacterReady, 'rive');

  adapter.playEntrance();
  assert.equal(enter.fired, 1);

  adapter.setState('listening');
  adapter.setState('thinking');
  adapter.setState('reply_ready');
  adapter.setState('disabled');

  assert.equal(attention.fired, 1);
  assert.equal(mode.value, 4);

  adapter.destroy();
  assert.equal(calls.cleanup, 1);
});

test('uses fallback immediately for reduced motion without loading Rive', async () => {
  const EchoCharacter = await loadCharacterApi({
    matchMedia(query) {
      assert.equal(query, '(prefers-reduced-motion: reduce)');
      return { matches: true };
    }
  });
  const { root, shell } = createRoot();
  let loaded = false;

  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => {
      loaded = true;
    }
  }).create(root);

  assert.equal(await adapter.ready, false);
  assert.equal(loaded, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
});

test('default script loader reuses existing window.rive without inserting a script', async () => {
  const head = new FakeElement('head');
  const document = {
    head,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      element.tagName = tagName;
      return element;
    }
  };
  const rive = { Rive: class {}, RuntimeLoader: {}, Layout: class {}, Fit: {}, Alignment: {} };
  const window = { rive, document };

  const EchoCharacter = await loadCharacterApi({ window, document });
  const runtime = await EchoCharacter.createWithDeps().loadRive();

  assert.equal(runtime, rive);
  assert.equal(head.children.length, 0);
});

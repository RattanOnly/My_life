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
    child.parentElement = this;
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
  const enter = { name: 'enter', fired: 0, fire() { this.fired += 1; } };
  const attention = { name: 'attention', fired: 0, fire() { this.fired += 1; } };
  const mode = { name: 'mode', value: -1 };
  const reducedMotion = { name: 'reducedMotion', value: true };
  let riveOptions = null;
  let readySettled = false;
  const calls = {
    stateMachineInputs: [],
    resizeDrawingSurfaceToCanvas: 0,
    cleanup: 0,
    src: null
  };
  class FakeRive {
    constructor(options) {
      riveOptions = options;
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
      RuntimeLoader: { setWasmUrl(url) { calls.wasmUrl = url; }, setWasmFallbackUrl(url) { calls.fallbackUrl = url; } },
      Layout: class {},
      Fit: { Contain: 'contain' },
      Alignment: { Center: 'center' }
    })
  }).create(root);

  adapter.ready.then(() => {
    readySettled = true;
  });
  await new Promise(resolve => setImmediate(resolve));

  assert.ok(riveOptions);
  assert.equal(typeof riveOptions.onLoad, 'function');
  assert.equal(typeof riveOptions.onLoadError, 'function');
  assert.deepEqual(calls.stateMachineInputs, []);
  assert.equal(calls.resizeDrawingSurfaceToCanvas, 0);
  assert.equal(shell.dataset.echoCharacterReady, undefined);
  assert.equal(readySettled, false);

  riveOptions.onLoad();
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

test('falls back when the Rive instance reports onLoadError', async () => {
  let riveOptions = null;
  let cleanupCalls = 0;
  class FakeRive {
    constructor(options) {
      riveOptions = options;
    }

    cleanup() {
      cleanupCalls += 1;
    }
  }

  const EchoCharacter = await loadCharacterApi();
  const { root, shell, fallback } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.ok(riveOptions);

  adapter.setState('thinking');
  riveOptions.onLoadError(new Error('rive file failed'));

  assert.equal(await adapter.ready, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
  assert.equal(shell.dataset.echoCharacterState, 'thinking');
  assert.equal(fallback.dataset.echoCharacterState, 'thinking');
  assert.equal(cleanupCalls, 1);
});

test('falls back and cleans up when Rive onLoad setup throws', async () => {
  let riveOptions = null;
  let cleanupCalls = 0;
  class FakeRive {
    constructor(options) {
      riveOptions = options;
    }

    stateMachineInputs() {
      throw new Error('state machine unavailable');
    }

    cleanup() {
      cleanupCalls += 1;
    }
  }

  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.ok(riveOptions);

  assert.doesNotThrow(() => riveOptions.onLoad());
  assert.equal(await adapter.ready, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
  assert.equal(cleanupCalls, 1);
});

test('falls back when onLoad setup and cleanup both throw', async () => {
  let riveOptions = null;
  let cleanupCalls = 0;
  class FakeRive {
    constructor(options) {
      riveOptions = options;
    }

    stateMachineInputs() {
      throw new Error('state machine unavailable');
    }

    cleanup() {
      cleanupCalls += 1;
      throw new Error('cleanup unavailable');
    }
  }

  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.ok(riveOptions);

  assert.doesNotThrow(() => riveOptions.onLoad());
  const ready = await Promise.race([
    adapter.ready,
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('adapter.ready did not settle')), 50);
    })
  ]);
  assert.equal(ready, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
  assert.equal(cleanupCalls, 1);
});

test('does not bind unnamed or wrong-name Rive inputs by position', async () => {
  const wrongValueInput = { name: 'status', value: 'unchanged' };
  const wrongEnter = { name: 'start', fired: 0, fire() { this.fired += 1; } };
  const wrongAttention = { name: 'focus', fired: 0, fire() { this.fired += 1; } };
  let riveOptions = null;
  class FakeRive {
    constructor(options) {
      riveOptions = options;
    }

    stateMachineInputs() {
      return [wrongValueInput, wrongEnter, wrongAttention];
    }

    resizeDrawingSurfaceToCanvas() {}
  }

  const EchoCharacter = await loadCharacterApi();
  const { root } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  riveOptions.onLoad();
  assert.equal(await adapter.ready, true);

  adapter.setState('disabled');
  adapter.playEntrance();
  adapter.setState('listening');

  assert.equal(wrongValueInput.value, 'unchanged');
  assert.equal(wrongEnter.fired, 0);
  assert.equal(wrongAttention.fired, 0);
});

test('destroy before Rive onLoad cancels input binding and ready state', async () => {
  let riveOptions = null;
  const calls = {
    cleanup: 0,
    stateMachineInputs: 0,
    resizeDrawingSurfaceToCanvas: 0
  };
  class FakeRive {
    constructor(options) {
      riveOptions = options;
    }

    stateMachineInputs() {
      calls.stateMachineInputs += 1;
      return [];
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
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.ok(riveOptions);

  adapter.destroy();
  riveOptions.onLoad();

  assert.equal(await adapter.ready, false);
  assert.notEqual(shell.dataset.echoCharacterReady, 'rive');
  assert.equal(calls.cleanup, 1);
  assert.equal(calls.stateMachineInputs, 0);
  assert.equal(calls.resizeDrawingSurfaceToCanvas, 0);
});

test('destroy after Rive construction settles ready false when runtime never calls back', async () => {
  let riveOptions = null;
  const calls = {
    cleanup: 0
  };
  class FakeRive {
    constructor(options) {
      riveOptions = options;
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
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.ok(riveOptions);

  adapter.destroy();

  const ready = await Promise.race([
    adapter.ready,
    new Promise((resolve, reject) => {
      setTimeout(() => reject(new Error('adapter.ready did not settle after destroy')), 50);
    })
  ]);
  assert.equal(ready, false);
  assert.equal(calls.cleanup, 1);
  assert.notEqual(shell.dataset.echoCharacterReady, 'rive');
});

test('destroy before the Rive runtime resolves prevents instance creation', async () => {
  let resolveRuntime = null;
  let constructed = 0;
  class FakeRive {
    constructor(options) {
      constructed += 1;
      options.onLoad();
    }
  }

  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: () => new Promise(resolve => {
      resolveRuntime = resolve;
    })
  }).create(root);

  await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof resolveRuntime, 'function');

  adapter.destroy();
  resolveRuntime({
    Rive: FakeRive,
    RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
  });

  assert.equal(await adapter.ready, false);
  assert.equal(constructed, 0);
  assert.equal(shell.dataset.echoCharacterReady, undefined);
});

test('falls back when the Rive constructor throws synchronously', async () => {
  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.createWithDeps({
    loadRive: async () => ({
      Rive: class FakeRive {
        constructor() {
          throw new Error('constructor unavailable');
        }
      },
      RuntimeLoader: { setWasmUrl() {}, setWasmFallbackUrl() {} }
    })
  }).create(root);

  assert.equal(await adapter.ready, false);
  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
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

test('default script loader retries after a script load failure', async () => {
  const scripts = [];
  const head = new FakeElement('head');
  const document = {
    head,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      element.tagName = tagName;
      element.remove = function remove() {
        this.removed = true;
      };
      return element;
    }
  };
  head.appendChild = child => {
    scripts.push(child);
    child.parentElement = head;
    return child;
  };
  const window = { document };
  const EchoCharacter = await loadCharacterApi({ window, document });
  const loader = EchoCharacter.createWithDeps();

  const firstLoad = loader.loadRive();
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, '/vendor/rive/rive.js');
  scripts[0].onerror();
  await assert.rejects(firstLoad, /Failed to load Rive runtime/);
  assert.equal(scripts[0].removed, true);

  const rive = { Rive: class {}, RuntimeLoader: {}, Layout: class {}, Fit: {}, Alignment: {} };
  const secondLoad = loader.loadRive();
  assert.equal(scripts.length, 2);
  window.rive = rive;
  scripts[1].onload();

  assert.equal(await secondLoad, rive);
});

test('default script loader retries after appendChild throws synchronously', async () => {
  const scripts = [];
  const head = new FakeElement('head');
  const document = {
    head,
    createElement(tagName) {
      const element = new FakeElement(tagName);
      element.tagName = tagName;
      element.remove = function remove() {
        this.removed = true;
      };
      scripts.push(element);
      return element;
    }
  };
  let appendAttempts = 0;
  head.appendChild = child => {
    appendAttempts += 1;
    child.parentElement = head;
    if (appendAttempts === 1) {
      throw new Error('append failed');
    }
    return child;
  };
  const window = { document };
  const EchoCharacter = await loadCharacterApi({ window, document });
  const loader = EchoCharacter.createWithDeps();

  await assert.rejects(loader.loadRive(), /append failed/);
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].removed, true);

  const rive = { Rive: class {}, RuntimeLoader: {}, Layout: class {}, Fit: {}, Alignment: {} };
  const secondLoad = loader.loadRive();
  assert.equal(appendAttempts, 2);
  assert.equal(scripts.length, 2);
  window.rive = rive;
  scripts[1].onload();

  assert.equal(await secondLoad, rive);
});

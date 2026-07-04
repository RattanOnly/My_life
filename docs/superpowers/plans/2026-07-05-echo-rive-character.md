# Echo Rive Character Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current rough Echo CSS character with a scoped Rive-powered Q-style backpack boy character that reacts smoothly to chat states while preserving a static fallback.

**Architecture:** Keep the Hexo/NexT site static and load all character code only on `/echo/`. Add a small `EchoCharacter` adapter between chat state and Rive state machine inputs so `echo-chat.js` never calls Rive APIs directly. Self-host `@rive-app/canvas-lite` runtime files during build so the browser does not depend on a third-party CDN at runtime.

**Tech Stack:** Hexo static page, plain JavaScript, Stylus, Node test runner, `@rive-app/canvas-lite@2.38.4`, Rive `.riv` asset exported from Rive editor.

---

## File Structure

- Create `tools/echo/copy-rive-runtime.mjs`: copies Rive runtime files from `node_modules/@rive-app/canvas-lite` into `source/vendor/rive/` before Hexo generates the site.
- Modify `package.json` and `package-lock.json`: add `@rive-app/canvas-lite`, add `copy:rive`, and ensure `npm run build` and local dev copy the runtime first.
- Modify `.gitignore`: ignore generated `source/vendor/rive/`.
- Create `source/js/echo-character.js`: Echo-only character adapter. It lazy-loads `/vendor/rive/rive.js`, points `RuntimeLoader` at self-hosted wasm files, manages Rive state inputs, and falls back to CSS state classes.
- Modify `source/js/echo-chat.js`: create one character adapter instance and send semantic states to it.
- Modify `source/echo/index.md`: replace the current multi-div CSS character with a Rive canvas plus static image fallback.
- Create `source/echo/assets/echo-boy-fallback.svg`: static Q-style backpack boy fallback shown before or instead of Rive.
- Add `source/echo/assets/echo-boy.riv`: exported Rive asset with the `EchoBoy` artboard and `EchoBoyState` state machine.
- Modify `source/_data/styles.styl`: style the character shell, canvas, fallback image, state classes, reduced motion, and mobile sizing.
- Modify `test/echo-page.test.mjs`: update markup, style, and chat-state tests.
- Create `test/rive-runtime-copy.test.mjs`: verify runtime copy configuration.
- Create `test/echo-character.test.mjs`: unit-test adapter fallback and Rive state mapping with a fake Rive module.

---

## Task 1: Self-Host The Rive Runtime

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `tools/echo/copy-rive-runtime.mjs`
- Test: `test/rive-runtime-copy.test.mjs`

- [ ] **Step 1: Write the failing runtime-copy test**

Create `test/rive-runtime-copy.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Rive runtime is copied from npm package before Hexo generation', async () => {
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  const copyScript = await readFile(new URL('../tools/echo/copy-rive-runtime.mjs', import.meta.url), 'utf8');
  const gitignore = await readFile(new URL('../.gitignore', import.meta.url), 'utf8');

  assert.equal(packageJson.dependencies['@rive-app/canvas-lite'], '^2.38.4');
  assert.equal(packageJson.scripts['copy:rive'], 'node tools/echo/copy-rive-runtime.mjs');
  assert.match(packageJson.scripts.build, /npm run copy:rive &&/);
  assert.match(packageJson.scripts.predev, /npm run copy:rive &&/);

  assert.match(copyScript, /@rive-app\/canvas-lite\/rive\.js/);
  assert.match(copyScript, /rive\.wasm/);
  assert.match(copyScript, /rive_fallback\.wasm/);
  assert.match(copyScript, /source\/vendor\/rive/);

  assert.match(gitignore, /^source\/vendor\/rive\/$/m);
});
```

- [ ] **Step 2: Run the new test and verify it fails**

Run:

```bash
node --test test/rive-runtime-copy.test.mjs
```

Expected: FAIL because `tools/echo/copy-rive-runtime.mjs` does not exist and the dependency/scripts are not configured.

- [ ] **Step 3: Add the runtime dependency**

Run:

```bash
npm install @rive-app/canvas-lite@2.38.4 --save
```

Expected: `package.json` and `package-lock.json` include `@rive-app/canvas-lite`.

- [ ] **Step 4: Add the copy script**

Create `tools/echo/copy-rive-runtime.mjs`:

```js
import { dirname, join } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const riveRuntimePath = require.resolve('@rive-app/canvas-lite/rive.js');
const riveRuntimeDir = dirname(riveRuntimePath);
const targetDir = join(process.cwd(), 'source', 'vendor', 'rive');

const files = ['rive.js', 'rive.wasm', 'rive_fallback.wasm'];

await mkdir(targetDir, { recursive: true });

await Promise.all(
  files.map(fileName =>
    copyFile(join(riveRuntimeDir, fileName), join(targetDir, fileName))
  )
);
```

- [ ] **Step 5: Update scripts and ignored generated files**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "copy:rive": "node tools/echo/copy-rive-runtime.mjs",
    "build": "npm run copy:rive && ./tools/hexo-env.sh generate",
    "predev": "npm run copy:rive && ./tools/hexo-env.sh clean && ./tools/hexo-env.sh generate && ./tools/hexo-env.sh algolia"
  }
}
```

Keep the other existing scripts unchanged.

Append to `.gitignore`:

```gitignore
source/vendor/rive/
```

- [ ] **Step 6: Run the copy script and verify generated files exist**

Run:

```bash
npm run copy:rive
test -f source/vendor/rive/rive.js
test -f source/vendor/rive/rive.wasm
test -f source/vendor/rive/rive_fallback.wasm
```

Expected: all commands exit successfully. `git status --short source/vendor/rive` should not list generated files because the directory is ignored.

- [ ] **Step 7: Run the runtime-copy test and verify it passes**

Run:

```bash
node --test test/rive-runtime-copy.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Commit Task 1**

Run:

```bash
git add package.json package-lock.json .gitignore tools/echo/copy-rive-runtime.mjs test/rive-runtime-copy.test.mjs
git commit -m "build: self-host Rive runtime for Echo"
```

---

## Task 2: Replace The Echo Character Markup With A Rive Slot

**Files:**
- Modify: `source/echo/index.md`
- Create: `source/echo/assets/echo-boy-fallback.svg`
- Test: `test/echo-page.test.mjs`

- [ ] **Step 1: Update the page shell test**

In `test/echo-page.test.mjs`, update `Echo page renders a standalone AI conversation shell` assertions so the page requires the Rive slot and fallback image:

```js
assert.match(page, /data-echo-stage="idle"/);
assert.match(page, /data-echo-character/);
assert.match(page, /data-echo-rive-canvas/);
assert.match(page, /data-echo-character-fallback/);
assert.match(page, /src="\/echo\/assets\/echo-boy-fallback\.svg"/);
assert.match(page, /data-echo-rive-src="\/echo\/assets\/echo-boy\.riv"/);
assert.match(page, /\/js\/echo-character\.js/);
assert.match(page, /\/js\/echo-chat\.js/);
assert.doesNotMatch(page, /class="echo-boy"/);
```

Also replace the old `data-echo-stage="idle_sit"` assertion with `data-echo-stage="idle"`.

- [ ] **Step 2: Run the page shell test and verify it fails**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: FAIL because the page still contains the current CSS-built boy markup.

- [ ] **Step 3: Add the static fallback image**

Create `source/echo/assets/echo-boy-fallback.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" role="img" aria-hidden="true">
  <defs>
    <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="150%">
      <feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#7f7568" flood-opacity="0.18"/>
    </filter>
  </defs>
  <ellipse cx="122" cy="202" rx="54" ry="10" fill="#b8ae9e" opacity=".28"/>
  <g filter="url(#soft-shadow)">
    <path d="M153 100c23 6 35 27 27 53l-9 30c-3 11-15 17-27 13l-7-2 18-94z" fill="#8f6b43"/>
    <path d="M91 96c-21 7-34 28-29 51l8 35c3 12 15 20 28 17l7-2-14-101z" fill="#a8875d"/>
    <path d="M82 92c5-27 24-45 49-45 28 0 48 20 51 48 4 34-15 66-49 66-35 0-57-31-51-69z" fill="#f1d6bd"/>
    <path d="M82 91c2-32 25-54 55-54 26 0 44 17 49 42-8-7-21-12-38-12-25 0-45 9-66 24z" fill="#2f302d"/>
    <path d="M74 103c0-10 5-17 13-17 5 0 9 4 9 11 0 9-6 17-13 17-5 0-9-4-9-11z" fill="#ecc8aa"/>
    <path d="M173 104c0-10 5-18 13-18 5 0 9 4 9 11 0 9-6 18-13 18-5 0-9-5-9-11z" fill="#ecc8aa"/>
    <path d="M106 110c0 4 3 7 7 7s7-3 7-7-3-7-7-7-7 3-7 7zm41 0c0 4 3 7 7 7s7-3 7-7-3-7-7-7-7 3-7 7z" fill="#373735"/>
    <path d="M123 132c8 6 19 6 27 0" fill="none" stroke="#7c5d4e" stroke-width="5" stroke-linecap="round"/>
    <path d="M89 157c8-13 23-20 39-20s31 7 39 20l10 37H80l9-37z" fill="#ded8ca"/>
    <path d="M96 160c9 12 22 18 33 18 12 0 24-7 32-18l7 34H89l7-34z" fill="#c8d6d1"/>
    <path d="M93 169c-13 7-26 5-31-3-3-6 0-12 6-15 8-4 18 0 28 9l-3 9z" fill="#f1d6bd"/>
    <path d="M166 169c13 7 26 5 31-3 3-6 0-12-6-15-8-4-18 0-28 9l3 9z" fill="#f1d6bd"/>
    <path d="M105 194h18v18h-24l6-18zm34 0h18l6 18h-24v-18z" fill="#3b3f46"/>
  </g>
</svg>
```

- [ ] **Step 4: Replace the Echo character markup**

In `source/echo/index.md`, set the section stage to `idle` and replace the old `.echo-scene` content with:

```html
<div
class="echo-character"
data-echo-character
data-echo-rive-src="/echo/assets/echo-boy.riv"
aria-hidden="true"
>
<canvas
class="echo-character-canvas"
data-echo-rive-canvas
width="320"
height="240"
></canvas>
<img
class="echo-character-fallback"
data-echo-character-fallback
src="/echo/assets/echo-boy-fallback.svg"
alt=""
loading="eager"
decoding="async"
>
<div class="echo-thought" data-echo-thought>...</div>
</div>
```

Load the character adapter before chat logic:

```html
<script src="/js/echo-character.js"></script>
<script src="/js/echo-chat.js"></script>
```

- [ ] **Step 5: Run the page shell test and verify it passes**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: PASS for the page shell test. Other Echo tests may still fail until Tasks 3, 4, and 5 update scripts and styles.

- [ ] **Step 6: Commit Task 2**

Run:

```bash
git add source/echo/index.md source/echo/assets/echo-boy-fallback.svg test/echo-page.test.mjs
git commit -m "feat: add Echo Rive character slot"
```

---

## Task 3: Add The Echo Character Adapter

**Files:**
- Create: `source/js/echo-character.js`
- Create: `test/echo-character.test.mjs`

- [ ] **Step 1: Write adapter tests for fallback behavior**

Create `test/echo-character.test.mjs` with the fake DOM classes copied from `test/echo-page.test.mjs` where needed:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const characterScriptUrl = new URL('../source/js/echo-character.js', import.meta.url);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.attributes = new Map();
    this.classList = {
      values: new Set(),
      add: (...names) => names.forEach(name => this.classList.values.add(name)),
      remove: (...names) => names.forEach(name => this.classList.values.delete(name)),
      contains: name => this.classList.values.has(name)
    };
    this.dataset = {};
    this.selectorMap = new Map();
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
}

const loadCharacterApi = async extraContext => {
  const context = createContext({
    console: { warn() {} },
    setTimeout,
    clearTimeout,
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

test('EchoCharacter falls back to CSS states when Rive import fails', async () => {
  const api = await loadCharacterApi({
    matchMedia: () => ({ matches: false })
  });
  const { root, shell } = createRoot();

  const adapter = api.createWithDeps({
    importRive: async () => {
      throw new Error('network unavailable');
    },
    matchMedia: () => ({ matches: false })
  }).create(root);

  await adapter.ready;
  adapter.setState('thinking');
  adapter.playEntrance();

  assert.equal(shell.dataset.echoCharacterReady, 'fallback');
  assert.equal(shell.dataset.echoCharacterState, 'thinking');
  assert.equal(shell.dataset.echoCharacterEntered, 'true');
});
```

- [ ] **Step 2: Add adapter test for Rive input mapping**

Append to `test/echo-character.test.mjs`:

```js
test('EchoCharacter maps semantic states to Rive state machine inputs', async () => {
  const modeInput = { name: 'mode', value: 0 };
  const enterInput = { name: 'enter', fireCount: 0, fire() { this.fireCount += 1; } };
  const attentionInput = { name: 'attention', fireCount: 0, fire() { this.fireCount += 1; } };
  const reducedMotionInput = { name: 'reducedMotion', value: false };
  const instances = [];

  class FakeRive {
    constructor(options) {
      this.options = options;
      this.cleaned = false;
      instances.push(this);
      queueMicrotask(() => options.onLoad());
    }

    resizeDrawingSurfaceToCanvas() {
      this.resized = true;
    }

    stateMachineInputs(name) {
      assert.equal(name, 'EchoBoyState');
      return [modeInput, enterInput, attentionInput, reducedMotionInput];
    }

    cleanup() {
      this.cleaned = true;
    }
  }

  const api = await loadCharacterApi({
    matchMedia: () => ({ matches: false })
  });
  const { root, shell } = createRoot();

  const adapter = api.createWithDeps({
    importRive: async () => ({
      Rive: FakeRive,
      RuntimeLoader: {
        setWasmUrl(value) { this.wasmUrl = value; },
        setWasmFallbackUrl(value) { this.fallbackUrl = value; }
      },
      Layout: class Layout {
        constructor(options) { this.options = options; }
      },
      Fit: { Contain: 'contain' },
      Alignment: { Center: 'center' }
    }),
    matchMedia: () => ({ matches: false })
  }).create(root);

  await adapter.ready;
  adapter.playEntrance();
  adapter.setState('listening');
  adapter.setState('thinking');
  adapter.setState('reply_ready');
  adapter.setState('disabled');
  adapter.destroy();

  assert.equal(shell.dataset.echoCharacterReady, 'rive');
  assert.equal(instances[0].options.src, '/echo/assets/echo-boy.riv');
  assert.equal(instances[0].resized, true);
  assert.equal(enterInput.fireCount, 1);
  assert.equal(attentionInput.fireCount, 1);
  assert.equal(modeInput.value, 4);
  assert.equal(instances[0].cleaned, true);
});
```

- [ ] **Step 3: Run adapter tests and verify they fail**

Run:

```bash
node --test test/echo-character.test.mjs
```

Expected: FAIL because `source/js/echo-character.js` does not exist.

- [ ] **Step 4: Implement the adapter**

Create `source/js/echo-character.js`:

```js
(() => {
  const globalScope = typeof window === 'object' ? window : globalThis;
  const RIVE_MODULE_URL = '/vendor/rive/rive.js';
  const RIVE_WASM_URL = '/vendor/rive/rive.wasm';
  const RIVE_WASM_FALLBACK_URL = '/vendor/rive/rive_fallback.wasm';
  const STATE_MACHINE_NAME = 'EchoBoyState';
  const MODE_BY_STATE = {
    idle: 0,
    listening: 1,
    thinking: 2,
    reply_ready: 3,
    disabled: 4,
    error: 0
  };

  const createNoopAdapter = () => ({
    ready: Promise.resolve(false),
    playEntrance() {},
    setState() {},
    destroy() {}
  });

  const findInput = (inputs, name) => inputs.find(input => input.name === name);

  const createFactory = ({
    importRive = () => import(RIVE_MODULE_URL),
    matchMedia = query => globalScope.matchMedia && globalScope.matchMedia(query)
  } = {}) => ({
    create(root) {
      const shell = root && root.querySelector('[data-echo-character]');
      if (!shell) return createNoopAdapter();

      const canvas = shell.querySelector('[data-echo-rive-canvas]');
      const fallback = shell.querySelector('[data-echo-character-fallback]');
      const src = shell.dataset.echoRiveSrc || '/echo/assets/echo-boy.riv';
      const reduceMotion = Boolean(matchMedia('(prefers-reduced-motion: reduce)')?.matches);
      let riveInstance = null;
      let modeInput = null;
      let enterInput = null;
      let attentionInput = null;
      let reducedMotionInput = null;
      let currentState = 'idle';

      const setFallbackState = state => {
        shell.dataset.echoCharacterState = state;
        if (fallback) fallback.setAttribute('data-echo-character-state', state);
      };

      const setState = state => {
        currentState = MODE_BY_STATE[state] === undefined ? 'idle' : state;
        setFallbackState(currentState);
        if (modeInput) modeInput.value = MODE_BY_STATE[currentState];
        if (currentState === 'listening' && attentionInput) attentionInput.fire();
      };

      const ready = (async () => {
        if (!canvas || reduceMotion) {
          shell.dataset.echoCharacterReady = 'fallback';
          setFallbackState(currentState);
          return false;
        }

        try {
          const rive = await importRive();
          rive.RuntimeLoader.setWasmUrl(RIVE_WASM_URL);
          rive.RuntimeLoader.setWasmFallbackUrl(RIVE_WASM_FALLBACK_URL);
          await new Promise((resolve, reject) => {
            riveInstance = new rive.Rive({
              src,
              canvas,
              autoplay: true,
              stateMachines: STATE_MACHINE_NAME,
              layout: new rive.Layout({
                fit: rive.Fit.Contain,
                alignment: rive.Alignment.Center
              }),
              onLoad: () => {
                riveInstance.resizeDrawingSurfaceToCanvas();
                const inputs = riveInstance.stateMachineInputs(STATE_MACHINE_NAME);
                modeInput = findInput(inputs, 'mode');
                enterInput = findInput(inputs, 'enter');
                attentionInput = findInput(inputs, 'attention');
                reducedMotionInput = findInput(inputs, 'reducedMotion');
                if (reducedMotionInput) reducedMotionInput.value = reduceMotion;
                shell.dataset.echoCharacterReady = 'rive';
                setState(currentState);
                resolve();
              },
              onLoadError: reject
            });
          });
          return true;
        } catch (error) {
          shell.dataset.echoCharacterReady = 'fallback';
          setFallbackState(currentState);
          return false;
        }
      })();

      return {
        ready,
        playEntrance() {
          shell.dataset.echoCharacterEntered = 'true';
          if (enterInput && !reduceMotion) enterInput.fire();
        },
        setState,
        destroy() {
          if (riveInstance) riveInstance.cleanup();
          riveInstance = null;
        }
      };
    }
  });

  globalScope.EchoCharacter = {
    create(root) {
      return createFactory().create(root);
    },
    createWithDeps: createFactory
  };
})();
```

- [ ] **Step 5: Run adapter tests and verify they pass**

Run:

```bash
node --test test/echo-character.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add source/js/echo-character.js test/echo-character.test.mjs
git commit -m "feat: add Echo Rive character adapter"
```

---

## Task 4: Wire Chat State To The Character Adapter

**Files:**
- Modify: `source/js/echo-chat.js`
- Modify: `test/echo-page.test.mjs`

- [ ] **Step 1: Update frontend tests for semantic states**

In `test/echo-page.test.mjs`, add character adapter tracking to `createEchoRuntime`:

```js
const characterCalls = [];
const echoCharacter = {
  create() {
    return {
      ready: Promise.resolve(false),
      playEntrance() {
        characterCalls.push(['playEntrance']);
      },
      setState(state) {
        characterCalls.push(['setState', state]);
      },
      destroy() {}
    };
  }
};
```

Add `EchoCharacter: echoCharacter` to the VM context and return `characterCalls` from `createEchoRuntime`.

Replace old stage expectations:

```js
assert.equal(runtime.root.dataset.echoStage, 'disabled');
assert.equal(runtime.root.dataset.echoStage, 'listening');
assert.equal(runtime.root.dataset.echoStage, 'thinking');
assert.equal(runtime.root.dataset.echoStage, 'reply_ready');
assert.equal(runtime.root.dataset.echoStage, 'idle');
```

Add assertions after `runEchoScript(runtime)`:

```js
assert.deepEqual(runtime.characterCalls[0], ['playEntrance']);
assert.deepEqual(runtime.characterCalls[1], ['setState', 'idle']);
```

In the submit flow test, assert the adapter receives chat states:

```js
assert.deepEqual(runtime.characterCalls.filter(call => call[0] === 'setState').map(call => call[1]), [
  'idle',
  'listening',
  'thinking',
  'reply_ready',
  'listening',
  'thinking',
  'reply_ready'
]);
```

- [ ] **Step 2: Run Echo page tests and verify failures**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: FAIL because `echo-chat.js` still uses `idle_sit` and `walk`, and does not create the character adapter.

- [ ] **Step 3: Wire adapter into chat script**

In `source/js/echo-chat.js`, after endpoint constants, add:

```js
const character = globalThis.EchoCharacter && typeof globalThis.EchoCharacter.create === 'function'
  ? globalThis.EchoCharacter.create(root)
  : {
      ready: Promise.resolve(false),
      playEntrance() {},
      setState() {},
      destroy() {}
    };
```

Replace `setStage` with:

```js
const setStage = stage => {
  root.dataset.echoStage = stage;
  character.setState(stage);
};
```

After helper declarations and before `loadStatus().catch(...)`, initialize the entrance and idle state:

```js
character.playEntrance();
setStage('idle');
```

Change all stages:

```js
setStage('disabled');
setStage('thinking');
setStage(isDisabled ? 'disabled' : 'idle');
setStage('reply_ready');
setStage(messageField.value.trim() ? 'listening' : 'idle');
setStage('idle');
```

Add focus and blur listeners:

```js
messageField.addEventListener('focus', () => {
  setStage(messageField.value.trim() ? 'listening' : 'idle');
});

messageField.addEventListener('blur', () => {
  if (!messageField.value.trim()) setStage('idle');
});
```

- [ ] **Step 4: Run Echo page tests and adapter tests**

Run:

```bash
node --test test/echo-page.test.mjs test/echo-character.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
git add source/js/echo-chat.js test/echo-page.test.mjs
git commit -m "feat: connect Echo chat states to character"
```

---

## Task 5: Restyle The Character Shell And Fallback Motion

**Files:**
- Modify: `source/_data/styles.styl`
- Modify: `test/echo-page.test.mjs`

- [ ] **Step 1: Update style tests**

In `test/echo-page.test.mjs`, replace old `.echo-boy` assertions with:

```js
assert.match(styles, /\.echo-character/);
assert.match(styles, /\.echo-character-canvas/);
assert.match(styles, /\.echo-character-fallback/);
assert.match(styles, /\.echo-page\[data-echo-stage='thinking'\]\s+\.echo-character-fallback/);
assert.match(styles, /@keyframes echo-character-breathe/);
assert.match(styles, /@keyframes echo-character-think/);
assert.match(styles, /prefers-reduced-motion:\s*reduce/);
assert.match(styles, /\.echo-character-canvas,\n\s+\.echo-character-fallback/);
assert.doesNotMatch(styles, /\.echo-boy/);
```

- [ ] **Step 2: Run style tests and verify failures**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: FAIL because styles still target `.echo-boy`.

- [ ] **Step 3: Replace old character styles**

In `source/_data/styles.styl`, remove the `.echo-boy`, `.echo-boy-*`, and `echo-boy-walk` rules. Keep `.echo-page`, `.echo-belt`, messages, and form styles.

Add:

```stylus
.echo-character {
  position: relative;
  width: min(320px, 72vw);
  aspect-ratio: 4 / 3;
  margin: 0 auto -18px;
  pointer-events: none;
}

.echo-character-canvas,
.echo-character-fallback {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.echo-character-canvas {
  opacity: 0;
  transition: opacity .28s ease;
}

.echo-character[data-echo-character-ready='rive'] .echo-character-canvas {
  opacity: 1;
}

.echo-character[data-echo-character-ready='rive'] .echo-character-fallback {
  opacity: 0;
}

.echo-character-fallback {
  object-fit: contain;
  transform-origin: 50% 86%;
  animation: echo-character-breathe 3.6s ease-in-out infinite;
  transition: opacity .2s ease, transform .2s ease;
}

.echo-page[data-echo-stage='listening'] .echo-character-fallback {
  transform: translateY(-4px) rotate(-1deg);
}

.echo-page[data-echo-stage='thinking'] .echo-character-fallback {
  animation: echo-character-think 1.8s ease-in-out infinite;
}

.echo-page[data-echo-stage='reply_ready'] .echo-character-fallback {
  transform: translateY(-6px) rotate(1deg);
}

.echo-page[data-echo-stage='disabled'] .echo-character-fallback {
  filter: grayscale(.16);
  opacity: .78;
  animation-duration: 5.2s;
}

@keyframes echo-character-breathe {
  0%, 100% { transform: translateY(0) scale(1); }
  50% { transform: translateY(-3px) scale(1.012); }
}

@keyframes echo-character-think {
  0%, 100% { transform: translateY(0) rotate(-1deg); }
  50% { transform: translateY(4px) rotate(1deg); }
}
```

In the mobile media block, add:

```stylus
.echo-character {
  width: min(260px, 76vw);
  margin-bottom: -12px;
}
```

In the reduced-motion block, include:

```stylus
.echo-character-fallback {
  animation: none;
}
```

- [ ] **Step 4: Run style tests**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit Task 5**

Run:

```bash
git add source/_data/styles.styl test/echo-page.test.mjs
git commit -m "style: refine Echo character motion states"
```

---

## Task 6: Add The Rive Character Asset

**Files:**
- Create: `source/echo/assets/echo-boy.riv`
- Test: `test/echo-page.test.mjs`

- [ ] **Step 1: Add an asset existence test**

In `test/echo-page.test.mjs`, add:

```js
test('Echo Rive character asset is present for production animation', async () => {
  const asset = await readFile(new URL('../source/echo/assets/echo-boy.riv', import.meta.url));

  assert.ok(asset.byteLength > 1024);
});
```

- [ ] **Step 2: Run the asset test and verify it fails**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: FAIL because `source/echo/assets/echo-boy.riv` is not present yet.

- [ ] **Step 3: Produce the Rive asset**

Create the asset in Rive editor with this contract:

```text
Artboard name: EchoBoy
State machine name: EchoBoyState
Number input: mode
Trigger input: enter
Trigger input: attention
Boolean input: reducedMotion

mode 0: idle blink and breathe
mode 1: listening lean and glance
mode 2: thinking seated or thoughtful loop
mode 3: reply ready nod or small hand gesture
mode 4: disabled resting pose
enter trigger: short walk-in sequence
attention trigger: short head movement
```

Export the file as:

```text
source/echo/assets/echo-boy.riv
```

The art style is Q-style backpack boy: large head, simple body, dark hair, light shirt or jacket, dark trousers, brown backpack.

- [ ] **Step 4: Run the asset test**

Run:

```bash
node --test test/echo-page.test.mjs
```

Expected: PASS for the asset existence test.

- [ ] **Step 5: Commit Task 6**

Run:

```bash
git add source/echo/assets/echo-boy.riv test/echo-page.test.mjs
git commit -m "feat: add Echo Rive character asset"
```

---

## Task 7: Full Verification

**Files:**
- No planned source edits.

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test test/rive-runtime-copy.test.mjs test/echo-character.test.mjs test/echo-page.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run the full project test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 3: Build the site**

Run:

```bash
npm run build
```

Expected: PASS. Confirm `public/vendor/rive/rive.js`, `public/vendor/rive/rive.wasm`, and `public/echo/assets/echo-boy.riv` exist after generation.

- [ ] **Step 4: Run a local preview**

Run:

```bash
npm run server
```

Open `http://localhost:4000/echo/`.

Expected:

- the page loads without console errors
- the character area has stable size before the `.riv` asset finishes loading
- the fallback image is visible if `source/echo/assets/echo-boy.riv` is temporarily renamed
- the chat input works before Rive finishes loading
- typing changes the state to listening
- submitting a message changes the state to thinking
- receiving a response changes the state to reply ready

Stop the server before finishing.

- [ ] **Step 5: Commit verification-only fixes**

If verification required small fixes, commit only those files:

```bash
git add <verified-files>
git commit -m "fix: verify Echo Rive character behavior"
```

If no fixes were needed, do not create an empty commit.

---

## Self-Review

Spec coverage:

- Q-style backpack boy: Task 2 fallback SVG and Task 6 Rive asset contract.
- Rive primary runtime: Task 1 runtime copy and Task 3 adapter.
- State machine inputs: Task 3 adapter and Task 6 asset contract.
- Entrance, idle, listening, thinking, reply-ready, disabled states: Tasks 3, 4, 5, and 6.
- Echo-only loading: Task 1 self-hosted files and Task 2 page-only script tags.
- Fallback and reduced motion: Tasks 3 and 5.
- Performance: Task 1 scoped runtime copy, Task 3 lazy import, Task 5 stable dimensions.
- Accessibility: Task 2 keeps the visual character `aria-hidden`, Task 4 preserves text status, Task 5 respects reduced motion.

Known execution dependency:

- Code tasks can be completed without a Rive editor, but the production animation acceptance criteria require `source/echo/assets/echo-boy.riv` exported with the named artboard, state machine, and inputs from Task 6.

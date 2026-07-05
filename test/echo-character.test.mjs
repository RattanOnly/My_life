import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

const characterScriptUrl = new URL('../source/js/echo-character.js', import.meta.url);

class FakeElement {
  constructor(name) {
    this.name = name;
    this.dataset = {};
    this.selectorMap = new Map();
  }

  querySelector(selector) {
    return this.selectorMap.get(selector) || null;
  }
}

const loadCharacterApi = async extraContext => {
  const context = createContext({
    console: { warn() {} },
    ...extraContext
  });
  const script = await readFile(characterScriptUrl, 'utf8');
  runInContext(script, context, { filename: 'echo-character.js' });
  return context.EchoCharacter;
};

const createRoot = () => {
  const root = new FakeElement('root');
  const shell = new FakeElement('shell');
  const fallback = new FakeElement('fallback');
  shell.selectorMap.set('[data-echo-character-fallback]', fallback);
  root.selectorMap.set('[data-echo-character]', shell);
  return { root, shell, fallback };
};

test('initializes the SVG character shell and keeps state on the fallback', async () => {
  const EchoCharacter = await loadCharacterApi();
  const { root, shell, fallback } = createRoot();

  const adapter = EchoCharacter.create(root);

  assert.equal(await adapter.ready, true);
  assert.equal(shell.dataset.echoCharacterReady, 'svg');
  assert.equal(shell.dataset.echoCharacterState, 'idle');
  assert.equal(fallback.dataset.echoCharacterState, 'idle');

  adapter.setState('thinking');
  assert.equal(shell.dataset.echoCharacterState, 'thinking');
  assert.equal(fallback.dataset.echoCharacterState, 'thinking');

  adapter.setState('unknown-state');
  assert.equal(shell.dataset.echoCharacterState, 'idle');
  assert.equal(fallback.dataset.echoCharacterState, 'idle');
});

test('marks entrance unless reduced motion is preferred', async () => {
  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();

  const adapter = EchoCharacter.createWithDeps({
    prefersReducedMotion: () => false
  }).create(root);

  adapter.playEntrance();
  assert.equal(shell.dataset.echoCharacterEntered, 'true');

  const reduced = createRoot();
  const reducedAdapter = EchoCharacter.createWithDeps({
    prefersReducedMotion: () => true
  }).create(reduced.root);

  reducedAdapter.playEntrance();
  assert.equal(reduced.shell.dataset.echoCharacterEntered, undefined);
});

test('destroy prevents future character state changes', async () => {
  const EchoCharacter = await loadCharacterApi();
  const { root, shell } = createRoot();
  const adapter = EchoCharacter.create(root);

  adapter.destroy();
  adapter.setState('thinking');
  adapter.playEntrance();

  assert.equal(shell.dataset.echoCharacterState, 'idle');
  assert.equal(shell.dataset.echoCharacterEntered, undefined);
});

test('returns a noop adapter when the character shell is absent', async () => {
  const EchoCharacter = await loadCharacterApi();
  const root = new FakeElement('root');
  const adapter = EchoCharacter.create(root);

  assert.equal(await adapter.ready, false);
  assert.doesNotThrow(() => adapter.playEntrance());
  assert.doesNotThrow(() => adapter.setState('thinking'));
  assert.doesNotThrow(() => adapter.destroy());
});

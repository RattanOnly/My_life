import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { createContext, runInContext } from 'node:vm';

class Element {
  children = [];
  hidden = true;
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  addEventListener() {}
  focus() {}
}

async function invitation(text) {
  const panel = new Element();
  const chatForm = new Element();
  chatForm.hidden = false;
  const root = { querySelector: selector => selector === '[data-echo-letter]' ? panel : chatForm };
  const context = createContext({ document: { createElement: () => new Element() } });
  runInContext(await readFile(new URL('../source/js/echo-letter.js', import.meta.url), 'utf8'), context);
  const letter = context.EchoLetter.create({ root, endpoint: '/echo-letter' });
  const offered = letter.offer(text);
  return { offered, panelVisible: !panel.hidden, chatVisible: !chatForm.hidden };
}

test('recipient introductions and natural questions offer the hidden letter', async () => {
  for (const text of [
    '我是佳妮', '我是汤佳妮', '你好，我是佳妮呀！', '我就是汤佳妮。',
    '赵威给我留信了吗？', '赵威留下的信在哪里？', '赵威有给我留一封信吗？',
    '赵威有没有留给我什么话？', '我想看看赵威给我的信'
  ]) {
    assert.deepEqual(await invitation(text), { offered: true, panelVisible: true, chatVisible: false }, text);
  }
});

test('ordinary conversation and other people mentioning the recipient keep the chat open', async () => {
  for (const text of ['你好', '我不是佳妮', '你认识汤佳妮吗？', '赵威写的情书是哪一篇？', '赵威喜欢喝什么？']) {
    assert.deepEqual(await invitation(text), { offered: false, panelVisible: false, chatVisible: true }, text);
  }
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker from '../src/index.mjs';

// Synthetic memories keep the owner's real answers out of the public repository.
const config = {
  questions: [
    { prompt: '我们说过什么？', answerGroups: [['看星星']] },
    { prompt: '经常去吗，为什么？', answerGroups: [['不经常', '不常'], ['太远', '距离远']] }
  ],
  letter: '这是一封用于测试的信。',
  postscript: '测试信的背面。'
};
const env = { ECHO_LETTER_DATA: JSON.stringify(config), ECHO_LETTER_SECRET: 'test-only-signing-key' };

async function post(body, customEnv = env) {
  const response = await worker.fetch(new Request('https://lovezvv.com/echo-letter', {
    method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://lovezvv.com' },
    body: JSON.stringify(body)
  }), customEnv);
  return { response, body: await response.json() };
}

test('letter requires two correct memories, supports retries and never returns content before opening', async () => {
  const start = await post({ action: 'start' });
  assert.equal(start.response.status, 200);
  assert.equal(start.response.headers.get('cache-control'), 'no-store');
  assert.equal(start.response.headers.get('access-control-allow-origin'), 'https://lovezvv.com');
  assert.equal(start.body.question, config.questions[0].prompt);
  assert.equal(start.body.letter, undefined);
  assert.equal(start.body.answerGroups, undefined);
  assert.equal((await post({ action: 'open', token: start.body.token })).response.status, 403);

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const wrong = await post({ action: 'answer', token: start.body.token, answer: '答错了' });
    assert.equal(wrong.body.correct, false);
    assert.equal(wrong.body.letter, undefined);
  }
  const first = await post({ action: 'answer', token: start.body.token, answer: '看 星星！' });
  assert.equal(first.body.step, 1);
  assert.equal(first.body.question, config.questions[1].prompt);
  assert.equal((await post({ action: 'open', token: first.body.token })).response.status, 403);
  assert.equal((await post({ action: 'answer', token: first.body.token, answer: '不常' })).body.correct, false);
  assert.equal((await post({ action: 'answer', token: first.body.token, answer: '太远' })).body.correct, false);
  const second = await post({ action: 'answer', token: first.body.token, answer: '不常去，因为距离远。' });
  assert.equal(second.body.step, 2);
  assert.equal(second.body.letter, undefined);
  const opened = await post({ action: 'open', token: second.body.token });
  assert.equal(opened.body.letter, config.letter);
  assert.equal(opened.body.postscript, config.postscript);
  // No third answer, database, AI binding, or persistent visitor state is needed.
});

test('letter rejects absent, forged, altered and expired progress tokens', async () => {
  const start = await post({ action: 'start' });
  const [payload, signature] = start.body.token.split('.');
  const changed = JSON.parse(atob(payload));
  changed.step = 2;
  const altered = `${btoa(JSON.stringify(changed))}.${signature}`;
  for (const token of [undefined, 'not-a-token', altered, `${start.body.token}.extra`]) {
    const result = await post({ action: 'open', token });
    assert.equal(result.response.status, 401);
    assert.equal(result.body.restart, true);
    assert.equal(result.body.letter, undefined);
  }
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(env.ECHO_LETTER_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expired = btoa(JSON.stringify({ step: 2, expires: Date.now() - 1000 }));
  const signed = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(expired)));
  const token = `${expired}.${btoa(String.fromCharCode(...signed))}`;
  assert.equal((await post({ action: 'open', token })).response.status, 401);
});

test('letter fails closed when unconfigured and rejects malformed or oversized requests', async () => {
  assert.equal((await post({ action: 'start' }, {})).response.status, 503);
  assert.equal((await post(null)).response.status, 400);
  assert.equal((await post({ action: 'start', extra: 'x'.repeat(5000) })).response.status, 413);
  const start = await post({ action: 'start' });
  assert.equal((await post({ action: 'answer', token: start.body.token, answer: {} })).response.status, 400);
});

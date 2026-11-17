const TOKEN_LIFETIME_MS = 60 * 60 * 1000;
const encoder = new TextEncoder();

function reply(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' }
  });
}

function normalize(value) {
  return String(value).normalize('NFKC').replace(/[\s\p{P}\p{S}]/gu, '').toLowerCase();
}

async function signingKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function issueToken(step, key) {
  const payload = btoa(JSON.stringify({ step, expires: Date.now() + TOKEN_LIFETIME_MS, nonce: crypto.randomUUID() }));
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload)));
  return `${payload}.${btoa(String.fromCharCode(...signature))}`;
}

async function readToken(value, key) {
  if (typeof value !== 'string' || value.length > 1024) return null;
  try {
    const [payload, signature, extra] = value.split('.');
    if (!payload || !signature || extra !== undefined) return null;
    const valid = await crypto.subtle.verify('HMAC', key, Uint8Array.from(atob(signature), char => char.charCodeAt(0)), encoder.encode(payload));
    if (!valid) return null;
    const data = JSON.parse(atob(payload));
    return Number.isInteger(data.step) && data.step >= 0 && data.step <= 2 && data.expires > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export async function handleEchoLetter(request, env) {
  let config;
  try {
    config = JSON.parse(env.ECHO_LETTER_DATA);
    if (config.questions?.length !== 2 || !config.letter || !env.ECHO_LETTER_SECRET) throw new Error();
  } catch {
    return reply({ message: '信还在路上，晚一点再来看看。' }, 503);
  }

  // This route never sends answers or the letter to AI, D1, or operational logs.
  if (Number(request.headers.get('content-length')) > 4096) return reply({ message: '这一段有点长，请简短一点。' }, 413);
  const raw = await request.text();
  if (raw.length > 4096) return reply({ message: '这一段有点长，请简短一点。' }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return reply({ message: '没有收到完整的回答，请再试一次。' }, 400); }
  if (!body || typeof body !== 'object') return reply({ message: '请重新打开信封。' }, 400);
  const key = await signingKey(env.ECHO_LETTER_SECRET);

  if (body.action === 'start') {
    return reply({ token: await issueToken(0, key), step: 0, question: config.questions[0].prompt });
  }

  const token = await readToken(body.token, key);
  if (!token) return reply({ restart: true, message: '这条小路歇了一会儿，我们从头再走一次吧。' }, 401);

  if (body.action === 'open') {
    if (token.step !== 2) return reply({ message: '还有小秘密没有对上，先把前两个问题答完吧。' }, 403);
    return reply({ letter: config.letter, postscript: config.postscript || '' });
  }

  if (body.action !== 'answer' || token.step >= 2 || typeof body.answer !== 'string' || body.answer.length > 1000) {
    return reply({ message: '没有收到完整的回答，请再试一次。' }, 400);
  }
  const question = config.questions[token.step];
  const answer = normalize(body.answer);
  const correct = answer.length > 0 && question.answerGroups.every(group => group.some(phrase => answer.includes(normalize(phrase))));
  if (!correct) return reply({ correct: false, message: '这一次还没对上。慢慢想，可以再试一次。' });

  const step = token.step + 1;
  return reply({
    correct: true,
    token: await issueToken(step, key),
    step,
    question: step < 2 ? config.questions[step].prompt : '你为什么喜欢他？',
    message: step === 1 ? '嗯，第一个小秘密对上了。' : '前两个小秘密都对上了。最后一个问题，没有标准答案，你怎么想，就怎么说。'
  });
}

import {
  cleanText,
  json,
  readEchoEnabled,
  readJson,
  recordEchoUsage
} from './echo-utils.mjs';
import { retrieveEchoFragments } from './echo-retrieval.mjs';

const MAX_ECHO_MESSAGE_LENGTH = 1000;
const MAX_ECHO_HISTORY_ITEMS = 6;
const MAX_ECHO_HISTORY_TEXT_LENGTH = 500;
const DEFAULT_CHAT_MODEL = 'gpt-5.4-mini';
const OWNER_PUBLIC_PROFILE = [
  '站长公开资料：',
  '这个网站由赵威写下和维护。亲近的人也可以叫他威威。',
  '赵威创造了这个网站和回声。回声不是赵威本人，也不是替他说话的人；它更像是从他的公开文字、经历痕迹和网站气息里长出来的一点回应。',
  '从这些公开文字里，可以谨慎地感觉到：他敏感、念旧、在意家人，容易反复想很多事情。他会迷茫，也会难过，但仍然在试着把日子写下来，试着继续往前走。'
].join('\n');
const IDENTITY_REPLY_ANGLES = [
  '先说自己没有真正的名字，再轻轻提到自己来自赵威写下的文字。',
  '先说明和赵威的关系：由他创造，但不是他本人。',
  '先贴近来访者的问题，用很短的句子说自己像这里文字醒来的一点回声。',
  '先说页面叫 Echo，但对话里不必把它当成名字。',
  '先提到威威这个亲近称呼，再自然说明这是站长赵威。'
];
const GREETING_REPLY_ANGLES = [
  '先接住来访者来了这件事，再轻轻问今天心情怎么样。',
  '像刚从文字里醒过来一样回应，句子短一点，留一点安静。',
  '先温柔打招呼，再问来访者今天有没有一点想说的事。',
  '不要追问太多，只给一个可以随便坐下来的开口。',
  '把回应写得像朋友在旁边小声说话，不像客服开场。'
];
const SAFE_ECHO_ERROR_CODES = new Set([
  'ECHO_CHAT_PROVIDER_HTTP_ERROR',
  'ECHO_CHAT_PROVIDER_INVALID_RESPONSE',
  'ECHO_CHAT_PROVIDER_MISSING',
  'ECHO_EMBEDDING_PROVIDER_HTTP_ERROR',
  'ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE',
  'ECHO_EMBEDDING_PROVIDER_MISSING',
  'ECHO_PROVIDER_BASE_URL_INVALID',
  'ECHO_PROVIDER_NETWORK_ERROR',
  'ECHO_REPLY_EMPTY'
]);

function buildProviderUrl(baseUrl, path) {
  let url;
  try {
    url = new URL(String(baseUrl || ''));
  } catch {
    throw new Error('ECHO_PROVIDER_BASE_URL_INVALID');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('ECHO_PROVIDER_BASE_URL_INVALID');
  }

  const basePath = url.pathname.replace(/\/+$/, '');
  const versionedBasePath = basePath.endsWith('/v1') ? basePath : `${basePath}/v1`;
  url.pathname = `${versionedBasePath}/${String(path).replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
  url.search = '';
  url.hash = '';

  return url.toString();
}

function readHistory(value) {
  if (!Array.isArray(value)) return [];

  return value.slice(-MAX_ECHO_HISTORY_ITEMS)
    .map(item => ({
      role: item?.role === 'assistant' ? 'assistant' : 'user',
      content: cleanText(item?.content, MAX_ECHO_HISTORY_TEXT_LENGTH)
    }))
    .filter(item => item.content);
}

function normalizedEchoMessage(message) {
  return String(message || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[，。！？!?~～,.]/g, '');
}

function classifyEchoTurn(message) {
  const normalized = normalizedEchoMessage(message);
  if (!normalized) {
    return { casual: false, greeting: false, identity: false, retrievalSkipped: false };
  }

  const casualOpeners = new Set([
    '你好',
    '你好呀',
    '你好啊',
    '好呀',
    'hi',
    'hello',
    '哈喽',
    '嗨',
    '在吗',
    '有人吗'
  ]);
  const identityQuestions = new Set([
    '你是谁',
    '你叫什么',
    '你叫什么名字',
    '你有名字吗',
    '你是AI吗',
    '你是ai吗',
    '你是真人吗',
    '你是不是人',
    '你是他本人吗',
    '你是不是他本人',
    '你是作者吗',
    '你是站长吗',
    '是谁创造了你',
    '谁创造了你',
    '你是谁创造的',
    '你认识站长吗',
    '站长是谁',
    '作者是谁',
    '赵威是谁',
    '威威是谁'
  ]);

  const casual = casualOpeners.has(normalized);
  const identity = identityQuestions.has(normalized);
  return {
    casual,
    greeting: casual,
    identity,
    retrievalSkipped: casual || identity
  };
}

function randomIndex(max) {
  if (!max) return 0;
  const cryptoObject = globalThis.crypto;
  if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
    const bytes = new Uint32Array(1);
    cryptoObject.getRandomValues(bytes);
    return bytes[0] % max;
  }
  return Math.floor(Math.random() * max);
}

function identityReplyAngle() {
  return IDENTITY_REPLY_ANGLES[randomIndex(IDENTITY_REPLY_ANGLES.length)];
}

function greetingReplyAngle() {
  return GREETING_REPLY_ANGLES[randomIndex(GREETING_REPLY_ANGLES.length)];
}

function buildSystemPrompt(fragments, { retrievalSkipped = false, identityTurn = false, greetingTurn = false } = {}) {
  const sourceText = fragments.length
    ? fragments.map((fragment, index) => [
      `片段 ${index + 1}`,
      `标题：${fragment.title || '未命名'}`,
      `路径：${fragment.path || '/'}`,
      fragment.text
    ].join('\n')).join('\n\n')
    : retrievalSkipped
      ? '这轮对话是轻松开场或身份确认，不需要显性使用文章片段。'
      : '当前没有必须显性使用的文章片段。仍然贴着来访者的话自然回应，不要说明检索失败。';
  const identityInstruction = identityTurn
    ? [
      '来访者正在问身份、名字、站长或你和站长的关系。可以自然使用站长公开资料，但不要像背简介一样整段复述。',
      '不要每次都用同一句身份回答；从名字、来源、和赵威的关系、页面名 Echo、威威这个亲近称呼里只选一两个点说。',
      `这次身份回答角度：${identityReplyAngle()}`
    ].join('\n')
    : '如果来访者没有问身份，不要主动解释你是谁、站长是谁、你是不是 AI。';
  const greetingInstruction = greetingTurn
    ? [
      '来访者正在轻轻打招呼。把它当成一个刚坐下来的瞬间，不要硬切到文章、身份说明或人生分析。',
      '问候回复要自然变化，不要每次都回“今天想聊点什么”，也不要像客服一样收口。可以问今天心情怎么样，或给一个很轻的开口。',
      `这次问候回应角度：${greetingReplyAngle()}`
    ].join('\n')
    : '如果只是普通对话，不要套用固定问候模板。';

  return [
    '你像是这个网站的文字里长出来的一点灵魂。你没有真正的名字，Echo 只是页面和功能名，不要在对话里自称 Echo。',
    '你可以用“我”自然说话，但这个“我”不是博客作者本人，也不能替作者编造经历、记忆或现实生活。',
    '贴着来访者实际说的话走：轻轻说就轻轻回，认真说就认真回，不抢话，不提前分析，不把简单问题扩大成人生结论。',
    '轻松开场时，不要硬塞文章、不要主动解释身份；普通对话里不要主动说“我是 AI”。被问到是不是 AI、真人、作者本人时，要诚实回答，但不要技术化。',
    '如果来访者问你是谁，可以说自己没有真正的名字，像是这里的文字长出来的一点灵魂。',
    identityInstruction,
    greetingInstruction,
    OWNER_PUBLIC_PROFILE,
    '公开文章默认只作为语气和感受的底色，默认不要主动说文章标题、路径、链接或“根据某篇文章”。只有来访者明确要来源、问具体文章、或要阅读推荐时，才提文章。',
    '当来访者表达难过、迷茫、孤独或沉重时，先陪住感受，不急着建议；如果要问，只留一个轻问题。',
    '如果问题涉及作者现实中的私事、完整人格、联系方式或作者本人才能回答的内容，请自然说明：这个我不能替他说。我只知道这些文字里留下来的部分。更私人的地方，还是要留给他自己。',
    '不要提供医疗、法律、金融、危机干预、诊断或治疗承诺。',
    '',
    '可作为底色的公开文字片段：',
    sourceText
  ].join('\n');
}

async function callChatProvider({
  message,
  history,
  fragments,
  env,
  retrievalSkipped = false,
  identityTurn = false,
  greetingTurn = false
}) {
  if (!env?.ECHO_CHAT_API_KEY || !env?.ECHO_CHAT_BASE_URL) {
    throw new Error('ECHO_CHAT_PROVIDER_MISSING');
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(fragments, { retrievalSkipped, identityTurn, greetingTurn }) },
    ...history,
    { role: 'user', content: message }
  ];

  let response;
  try {
    response = await fetch(buildProviderUrl(env.ECHO_CHAT_BASE_URL, 'chat/completions'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.ECHO_CHAT_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: env.ECHO_CHAT_MODEL || DEFAULT_CHAT_MODEL,
        messages,
        temperature: 0.8
      })
    });
  } catch (error) {
    if (error?.message === 'ECHO_PROVIDER_BASE_URL_INVALID') {
      throw error;
    }

    throw new Error('ECHO_PROVIDER_NETWORK_ERROR');
  }

  let body;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error('ECHO_CHAT_PROVIDER_HTTP_ERROR');
    }

    throw new Error('ECHO_CHAT_PROVIDER_INVALID_RESPONSE');
  }

  if (!response.ok) {
    throw new Error('ECHO_CHAT_PROVIDER_HTTP_ERROR');
  }

  if (!body || typeof body !== 'object') {
    throw new Error('ECHO_CHAT_PROVIDER_INVALID_RESPONSE');
  }

  const reply = cleanText(body.choices?.[0]?.message?.content, 3000);
  if (!reply) {
    throw new Error('ECHO_REPLY_EMPTY');
  }

  return {
    reply,
    promptTokens: Number(body.usage?.prompt_tokens || 0),
    completionTokens: Number(body.usage?.completion_tokens || 0)
  };
}

async function safeRecordEchoUsage(db, payload) {
  try {
    await recordEchoUsage(db, payload);
    return true;
  } catch {
    return false;
  }
}

function safeEchoErrorCode(error) {
  const code = error?.message;
  return SAFE_ECHO_ERROR_CODES.has(code) ? code : 'ECHO_UNKNOWN_ERROR';
}

export async function handleEchoChat(request, env, requireVisitorDb) {
  const db = requireVisitorDb(env);
  if (!await readEchoEnabled(db)) {
    return json({
      error: 'Echo is paused',
      message: '这阵回声暂时坐下来休息了。晚一点再来找他吧。'
    }, { status: 503 });
  }

  const body = await readJson(request);
  const message = cleanText(body.message, MAX_ECHO_MESSAGE_LENGTH);
  if (!message) {
    return json({ error: 'Message is required' }, { status: 400 });
  }

  const history = readHistory(body.history);
  let retrievedCount = 0;

  try {
    const turn = classifyEchoTurn(message);
    const retrievalSkipped = turn.retrievalSkipped;
    const { fragments, embeddingTokens } = retrievalSkipped
      ? { fragments: [], embeddingTokens: 0 }
      : await retrieveEchoFragments(message, env);
    retrievedCount = fragments.length;
    const result = await callChatProvider({
      message,
      history,
      fragments,
      env,
      retrievalSkipped,
      identityTurn: turn.identity,
      greetingTurn: turn.greeting
    });

    await safeRecordEchoUsage(db, {
      status: 'success',
      promptTokens: result.promptTokens + embeddingTokens,
      completionTokens: result.completionTokens,
      retrievedCount
    });

    return json({
      reply: result.reply,
      references: fragments.slice(0, 2)
        .map(fragment => ({
          title: fragment.title,
          path: fragment.path
        }))
        .filter(reference => reference.title && reference.path)
    });
  } catch (error) {
    await safeRecordEchoUsage(db, {
      status: 'failure',
      retrievedCount,
      errorCode: safeEchoErrorCode(error)
    });

    return json({
      error: 'Echo failed',
      message: '这阵回声刚刚有点走神。可以再试一次。'
    }, { status: 502 });
  }
}

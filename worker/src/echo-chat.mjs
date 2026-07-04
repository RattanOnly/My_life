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

function trimBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
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

function buildSystemPrompt(fragments) {
  const sourceText = fragments.length
    ? fragments.map((fragment, index) => [
      `片段 ${index + 1}`,
      `标题：${fragment.title || '未命名'}`,
      `路径：${fragment.path || '/'}`,
      fragment.text
    ].join('\n')).join('\n\n')
    : '没有检索到足够相关的公开文章片段。';

  return [
    '你是 Echo，一个由博客公开文字塑造出来的温暖回应者。',
    '你不是博客作者本人，也不是数字克隆，不要假装拥有作者没有公开提到的私人记忆。',
    '回答要像人一样自然、短一些，通常二到四段。',
    '先回应来访者的感受，再结合公开文字轻轻反照，最后留下一个温柔的继续空间。',
    '如果问题涉及作者没有公开提过的私人信息，请温和说明：这部分，他没有和我提起过，也许可以亲自去和他聊聊。',
    '不要提供医疗、法律、金融、危机干预、诊断或治疗承诺。',
    '',
    '可使用的公开文字片段：',
    sourceText
  ].join('\n');
}

async function callChatProvider({ message, history, fragments, env }) {
  if (!env?.ECHO_CHAT_API_KEY || !env?.ECHO_CHAT_BASE_URL) {
    throw new Error('ECHO_CHAT_PROVIDER_MISSING');
  }

  const messages = [
    { role: 'system', content: buildSystemPrompt(fragments) },
    ...history,
    { role: 'user', content: message }
  ];

  const response = await fetch(`${trimBaseUrl(env.ECHO_CHAT_BASE_URL)}/v1/chat/completions`, {
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

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || 'ECHO_CHAT_FAILED');
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
    const { fragments, embeddingTokens } = await retrieveEchoFragments(message, env);
    retrievedCount = fragments.length;
    const result = await callChatProvider({ message, history, fragments, env });

    await recordEchoUsage(db, {
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
    await recordEchoUsage(db, {
      status: 'failure',
      retrievedCount,
      errorCode: error?.message || 'ECHO_UNKNOWN_ERROR'
    });

    return json({
      error: 'Echo failed',
      message: '这阵回声刚刚有点走神。可以再试一次。'
    }, { status: 502 });
  }
}

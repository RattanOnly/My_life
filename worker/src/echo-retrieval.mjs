const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large';

function trimBaseUrl(value) {
  return String(value || '').replace(/\/+$/, '');
}

async function readProviderJson(response, errorCode) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || errorCode);
  }

  return body;
}

export async function createEmbedding(text, env) {
  if (!env?.ECHO_EMBEDDING_API_KEY || !env?.ECHO_EMBEDDING_BASE_URL) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_MISSING');
  }

  const response = await fetch(`${trimBaseUrl(env.ECHO_EMBEDDING_BASE_URL)}/v1/embeddings`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.ECHO_EMBEDDING_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.ECHO_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      input: text
    })
  });

  const body = await readProviderJson(response, 'ECHO_EMBEDDING_FAILED');
  const embedding = body.data?.[0]?.embedding;
  if (!Array.isArray(embedding)) {
    throw new Error('ECHO_EMBEDDING_EMPTY');
  }

  return {
    embedding,
    promptTokens: Number(body.usage?.prompt_tokens || 0)
  };
}

export async function retrieveEchoFragments(message, env) {
  if (!env?.ECHO_VECTORIZE) {
    return { fragments: [], embeddingTokens: 0 };
  }

  const { embedding, promptTokens } = await createEmbedding(message, env);
  const result = await env.ECHO_VECTORIZE.query(embedding, {
    topK: 5,
    returnMetadata: true
  });

  const fragments = (result.matches || [])
    .filter(match => match?.metadata?.text)
    .map(match => ({
      title: String(match.metadata.title || ''),
      path: String(match.metadata.path || ''),
      text: String(match.metadata.text || '').slice(0, 1200),
      score: Number(match.score || 0)
    }));

  return {
    fragments,
    embeddingTokens: promptTokens
  };
}

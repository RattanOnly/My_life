const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = '@cf/baai/bge-m3';

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

async function readProviderJson(response, { httpErrorCode, invalidResponseCode }) {
  let body;
  try {
    body = await response.json();
  } catch {
    if (!response.ok) {
      throw new Error(httpErrorCode);
    }

    throw new Error(invalidResponseCode);
  }

  if (!response.ok) {
    throw new Error(httpErrorCode);
  }

  if (!body || typeof body !== 'object') {
    throw new Error(invalidResponseCode);
  }

  return body;
}

function assertValidEmbedding(embedding) {
  if (
    !Array.isArray(embedding)
    || embedding.length === 0
    || !embedding.every(value => typeof value === 'number' && Number.isFinite(value))
  ) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE');
  }
}

export async function createEmbedding(text, env) {
  if (env?.AI) {
    let body;
    try {
      body = await env.AI.run(
        env.ECHO_WORKERS_AI_EMBEDDING_MODEL || DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
        { text: [text] }
      );
    } catch {
      throw new Error('ECHO_WORKERS_AI_ERROR');
    }

    const embedding = body?.data?.[0];
    assertValidEmbedding(embedding);

    return {
      embedding,
      promptTokens: 0
    };
  }

  if (!env?.ECHO_EMBEDDING_API_KEY || !env?.ECHO_EMBEDDING_BASE_URL) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_MISSING');
  }

  let response;
  try {
    response = await fetch(buildProviderUrl(env.ECHO_EMBEDDING_BASE_URL, 'embeddings'), {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.ECHO_EMBEDDING_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: env.ECHO_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
        input: text,
        encoding_format: 'float'
      })
    });
  } catch (error) {
    if (error?.message === 'ECHO_PROVIDER_BASE_URL_INVALID') {
      throw error;
    }

    throw new Error('ECHO_PROVIDER_NETWORK_ERROR');
  }

  const body = await readProviderJson(response, {
    httpErrorCode: 'ECHO_EMBEDDING_PROVIDER_HTTP_ERROR',
    invalidResponseCode: 'ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE'
  });
  const embedding = body.data?.[0]?.embedding;
  assertValidEmbedding(embedding);

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

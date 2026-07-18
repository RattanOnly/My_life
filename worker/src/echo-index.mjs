const DEFAULT_WORKERS_AI_EMBEDDING_MODEL = '@cf/baai/bge-m3';
const MAX_DOCUMENTS_PER_REQUEST = 20;
const MAX_ID_LENGTH = 128;
const MAX_TITLE_LENGTH = 200;
const MAX_PATH_LENGTH = 512;
const MAX_TEXT_LENGTH = 1200;

function json(body, init = {}) {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init.headers
    }
  });
}

function cleanString(value, maxLength) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeDocument(value) {
  const document = {
    id: cleanString(value?.id, MAX_ID_LENGTH),
    title: cleanString(value?.title, MAX_TITLE_LENGTH),
    path: cleanString(value?.path, MAX_PATH_LENGTH),
    text: cleanString(value?.text, MAX_TEXT_LENGTH),
    chunkIndex: Number(value?.chunkIndex)
  };

  if (
    !document.id
    || !document.title
    || !document.path
    || !document.text
    || !Number.isInteger(document.chunkIndex)
    || document.chunkIndex < 0
  ) {
    return null;
  }

  return document;
}

function isValidEmbedding(embedding) {
  return Array.isArray(embedding)
    && embedding.length > 0
    && embedding.every(value => typeof value === 'number' && Number.isFinite(value));
}

export async function handleEchoIndex(request, env) {
  if (
    !env?.ECHO_INDEX_TOKEN
    || request.headers.get('authorization') !== `Bearer ${env.ECHO_INDEX_TOKEN}`
  ) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env?.AI || !env?.ECHO_VECTORIZE) {
    return json({ error: 'Echo index bindings are unavailable' }, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.documents) || body.documents.length === 0) {
    return json({ error: 'Documents are required' }, { status: 400 });
  }
  if (body.documents.length > MAX_DOCUMENTS_PER_REQUEST) {
    return json({ error: 'Too many documents' }, { status: 413 });
  }

  const documents = body.documents.map(normalizeDocument);
  if (documents.some(document => !document)) {
    return json({ error: 'Invalid document' }, { status: 400 });
  }

  let result;
  try {
    result = await env.AI.run(
      env.ECHO_WORKERS_AI_EMBEDDING_MODEL || DEFAULT_WORKERS_AI_EMBEDDING_MODEL,
      { text: documents.map(document => `${document.title}\n${document.text}`) }
    );
  } catch {
    return json({ error: 'Embedding failed' }, { status: 502 });
  }

  const embeddings = result?.data;
  if (
    !Array.isArray(embeddings)
    || embeddings.length !== documents.length
    || embeddings.some(embedding => !isValidEmbedding(embedding))
  ) {
    return json({ error: 'Invalid embedding response' }, { status: 502 });
  }

  const vectors = documents.map((document, index) => ({
    id: document.id,
    values: embeddings[index],
    metadata: {
      title: document.title,
      path: document.path,
      text: document.text,
      chunkIndex: document.chunkIndex
    }
  }));

  try {
    await env.ECHO_VECTORIZE.upsert(vectors);
  } catch {
    return json({ error: 'Vector upsert failed' }, { status: 502 });
  }

  return json({ indexed: vectors.length });
}

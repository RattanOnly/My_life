import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';
const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
const DEFAULT_MAX_CHUNK_LENGTH = 900;
const DEFAULT_VECTORIZE_INDEX = 'my-life-echo-small';
const VECTORIZE_API_BASE = 'https://api.cloudflare.com/client/v4';
const DEFAULT_INDEX_BATCH_SIZE = 10;

export function parsePostFrontMatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { data: {}, content: markdown };

  const data = {};
  match[1].split('\n').forEach(line => {
    const pair = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!pair) return;
    const key = pair[1];
    const rawValue = pair[2].trim().replace(/^['"]|['"]$/g, '');
    data[key] = rawValue === 'true' ? true : rawValue;
  });

  return { data, content: match[2] };
}

function stripMarkdown(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function slugFromFilename(filename) {
  return filename.replace(/\.md$/i, '');
}

function pathFromPost(data, filename) {
  const date = String(data.date || '').slice(0, 10);
  const slug = slugFromFilename(filename);
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [year, month, day] = date.split('-');
    return `/${year}/${month}/${day}/${slug}/`;
  }
  return `/${slug}/`;
}

export function chunkEchoText(text, { maxLength = DEFAULT_MAX_CHUNK_LENGTH } = {}) {
  const clean = stripMarkdown(text);
  const chunks = [];
  for (let start = 0; start < clean.length; start += maxLength) {
    chunks.push({
      chunkIndex: chunks.length,
      text: clean.slice(start, start + maxLength)
    });
  }
  return chunks;
}

export async function buildEchoDocuments(rootDir = process.cwd()) {
  const postsDir = path.join(rootDir, 'source/_posts');
  const filenames = (await readdir(postsDir)).filter(filename => filename.endsWith('.md')).sort();
  const documents = [];

  for (const filename of filenames) {
    const markdown = await readFile(path.join(postsDir, filename), 'utf8');
    const { data, content } = parsePostFrontMatter(markdown);
    if (data.draft === true) continue;

    const title = String(data.title || slugFromFilename(filename));
    const postPath = pathFromPost(data, filename);
    chunkEchoText(content).forEach(chunk => {
      documents.push({
        id: `${slugFromFilename(filename)}-${chunk.chunkIndex}`,
        title,
        path: postPath,
        text: chunk.text,
        chunkIndex: chunk.chunkIndex
      });
    });
  }

  const ownerProfilePath = path.join(rootDir, 'source/_data/echo-owner-profile.md');
  const ownerProfile = await readFile(ownerProfilePath, 'utf8').catch(() => '');
  if (ownerProfile.trim()) {
    documents.push({
      id: 'owner-public-profile-0',
      title: 'Owner-Approved Public Profile',
      path: '/echo/',
      text: stripMarkdown(ownerProfile),
      chunkIndex: 0
    });
  }

  const toneSummaryPath = path.join(rootDir, 'source/_data/echo-tone-summary.md');
  const toneSummary = await readFile(toneSummaryPath, 'utf8').catch(() => '');
  if (toneSummary.trim()) {
    documents.push({
      id: 'owner-tone-summary-0',
      title: 'Owner-Approved Tone Summary',
      path: '/echo/',
      text: stripMarkdown(toneSummary),
      chunkIndex: 0
    });
  }

  return documents;
}

function resolveFetch(fetchImpl) {
  const resolvedFetch = fetchImpl || globalThis.fetch;
  if (typeof resolvedFetch !== 'function') {
    throw new Error('ECHO_FETCH_MISSING');
  }
  return resolvedFetch;
}

function buildProviderUrl(baseUrl, resourcePath) {
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
  url.pathname = `${versionedBasePath}/${String(resourcePath).replace(/^\/+/, '')}`.replace(/\/{2,}/g, '/');
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

function expectedEmbeddingDimensions(env = process.env) {
  const rawDimensions = env?.ECHO_EMBEDDING_DIMENSIONS;
  if (rawDimensions === undefined || rawDimensions === '') {
    return DEFAULT_EMBEDDING_DIMENSIONS;
  }

  const dimensions = Number(rawDimensions);
  if (!Number.isInteger(dimensions) || dimensions <= 0) {
    throw new Error('ECHO_EMBEDDING_DIMENSIONS_INVALID');
  }

  return dimensions;
}

function assertValidEmbedding(embedding, expectedDimensions) {
  if (
    !Array.isArray(embedding)
    || !embedding.every(value => typeof value === 'number' && Number.isFinite(value))
  ) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE');
  }

  if (embedding.length !== expectedDimensions) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_INVALID_DIMENSION');
  }
}

export async function createEmbedding(text, env = process.env, { fetchImpl } = {}) {
  if (!env?.ECHO_EMBEDDING_API_KEY || !env?.ECHO_EMBEDDING_BASE_URL) {
    throw new Error('ECHO_EMBEDDING_PROVIDER_MISSING');
  }

  const expectedDimensions = expectedEmbeddingDimensions(env);
  const providerUrl = buildProviderUrl(env.ECHO_EMBEDDING_BASE_URL, 'embeddings');
  const fetchFn = resolveFetch(fetchImpl);
  const request = {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.ECHO_EMBEDDING_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: env.ECHO_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL,
      input: text
    })
  };

  let fetchPromise;
  try {
    fetchPromise = fetchFn(providerUrl, request);
  } catch (error) {
    throw error;
  }

  let response;
  try {
    response = await fetchPromise;
  } catch {
    throw new Error('ECHO_PROVIDER_NETWORK_ERROR');
  }

  const body = await readProviderJson(response, {
    httpErrorCode: 'ECHO_EMBEDDING_PROVIDER_HTTP_ERROR',
    invalidResponseCode: 'ECHO_EMBEDDING_PROVIDER_INVALID_RESPONSE'
  });
  const embedding = body.data?.[0]?.embedding;
  assertValidEmbedding(embedding, expectedDimensions);

  return embedding;
}

function echoDocumentToVector(document, values) {
  return {
    id: document.id,
    values,
    metadata: {
      title: document.title,
      path: document.path,
      text: document.text,
      chunkIndex: document.chunkIndex
    }
  };
}

export async function buildEchoVectors(documents, env = process.env, { fetchImpl } = {}) {
  const vectors = [];
  for (const document of documents) {
    const values = await createEmbedding(document.text, env, { fetchImpl });
    vectors.push(echoDocumentToVector(document, values));
  }
  return vectors;
}

function hasCloudflareVectorizeEnv(env = process.env) {
  return Boolean(env?.CLOUDFLARE_ACCOUNT_ID && env?.CLOUDFLARE_API_TOKEN);
}

function hasWorkerIndexEnv(env = process.env) {
  return Boolean(env?.ECHO_INDEX_URL && env?.ECHO_INDEX_TOKEN);
}

async function syncViaWorker(documents, env = process.env, { fetchImpl } = {}) {
  const fetchFn = resolveFetch(fetchImpl);
  let count = 0;

  for (let start = 0; start < documents.length; start += DEFAULT_INDEX_BATCH_SIZE) {
    const batch = documents.slice(start, start + DEFAULT_INDEX_BATCH_SIZE);
    const response = await fetchFn(env.ECHO_INDEX_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.ECHO_INDEX_TOKEN}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ documents: batch })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || Number(body.indexed) !== batch.length) {
      throw new Error(body.error || 'ECHO_INDEX_SYNC_FAILED');
    }
    count += batch.length;
  }

  return { skipped: false, count };
}

function vectorizeIndexName(env = process.env) {
  return env?.ECHO_VECTORIZE_INDEX || DEFAULT_VECTORIZE_INDEX;
}

function vectorizeUrl(operation, env = process.env) {
  const accountId = encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID);
  const indexName = encodeURIComponent(vectorizeIndexName(env));
  return `${VECTORIZE_API_BASE}/accounts/${accountId}/vectorize/v2/indexes/${indexName}/${operation}`;
}

function buildNdjson(vectors) {
  return vectors.map(vector => JSON.stringify(vector)).join('\n') + '\n';
}

function buildVectorizeFormData(ndjson) {
  const formData = new FormData();
  formData.append('vectors', new Blob([ndjson], { type: 'application/x-ndjson' }), 'vectors.ndjson');
  return formData;
}

async function readVectorizeJson(response) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.errors?.[0]?.message || body.error?.message || 'ECHO_VECTORIZE_UPSERT_FAILED');
  }
  return body;
}

export async function upsertVectorizeVectors(vectors, env = process.env, { fetchImpl } = {}) {
  if (!hasCloudflareVectorizeEnv(env)) {
    throw new Error('ECHO_VECTORIZE_REMOTE_MISSING');
  }
  if (!vectors.length) {
    return { success: true, count: 0 };
  }

  const response = await resolveFetch(fetchImpl)(vectorizeUrl('upsert', env), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`
    },
    body: buildVectorizeFormData(buildNdjson(vectors))
  });

  return readVectorizeJson(response);
}

export async function rebuildVectorizeIndex(documents, env = process.env, { fetchImpl } = {}) {
  if (env?.ECHO_INDEX_URL || env?.ECHO_INDEX_TOKEN) {
    if (!hasWorkerIndexEnv(env)) {
      throw new Error('ECHO_INDEX_ENDPOINT_MISSING');
    }
    return syncViaWorker(documents, env, { fetchImpl });
  }

  if (!hasCloudflareVectorizeEnv(env)) {
    console.log('Skipping remote Vectorize rebuild because CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set.');
    return { skipped: true, count: documents.length };
  }

  const vectors = await buildEchoVectors(documents, env, { fetchImpl });
  await upsertVectorizeVectors(vectors, env, { fetchImpl });

  return { skipped: false, count: vectors.length };
}

async function main() {
  const documents = await buildEchoDocuments(process.cwd());
  console.log(`Prepared ${documents.length} Echo documents for ECHO_VECTORIZE.`);
  console.log('Embedding model: @cf/baai/bge-m3 (via protected Worker endpoint).');

  if (process.env.ECHO_INDEX_DRY_RUN === '1') {
    return;
  }

  await rebuildVectorizeIndex(documents);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}

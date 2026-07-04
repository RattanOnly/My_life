import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-large';
const DEFAULT_MAX_CHUNK_LENGTH = 900;

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

async function createEmbedding(text, env = process.env) {
  const baseUrl = String(env.ECHO_EMBEDDING_BASE_URL || '').replace(/\/+$/, '');
  if (!baseUrl || !env.ECHO_EMBEDDING_API_KEY) {
    throw new Error('Missing ECHO_EMBEDDING_BASE_URL or ECHO_EMBEDDING_API_KEY');
  }

  const response = await fetch(`${baseUrl}/v1/embeddings`, {
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
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'Embedding request failed');
  return body.data[0].embedding;
}

function cloudflareVectorizeUrl(env = process.env) {
  const accountId = env.CLOUDFLARE_ACCOUNT_ID;
  const indexName = env.ECHO_VECTORIZE_INDEX || 'my-life-echo-large';
  if (!accountId) return '';
  return `https://api.cloudflare.com/client/v4/accounts/${accountId}/vectorize/indexes/${indexName}/vectors`;
}

async function cloudflareVectorizeRequest(pathSuffix, options = {}, env = process.env) {
  if (!env.CLOUDFLARE_API_TOKEN) {
    throw new Error('Missing CLOUDFLARE_API_TOKEN');
  }

  const baseUrl = cloudflareVectorizeUrl(env);
  if (!baseUrl) {
    throw new Error('Missing CLOUDFLARE_ACCOUNT_ID');
  }

  const response = await fetch(`${baseUrl}${pathSuffix}`, {
    ...options,
    headers: {
      authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
      'content-type': 'application/json',
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.errors?.[0]?.message || body.error?.message || 'Vectorize request failed');
  }
  return body;
}

async function rebuildVectorizeIndex(documents, env = process.env) {
  if (!env.CLOUDFLARE_ACCOUNT_ID || !env.CLOUDFLARE_API_TOKEN) {
    console.log('Skipping remote Vectorize rebuild because CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not set.');
    return;
  }

  await cloudflareVectorizeRequest('', { method: 'DELETE' }, env);

  const vectors = [];
  for (const document of documents) {
    vectors.push({
      id: document.id,
      values: await createEmbedding(document.text, env),
      metadata: {
        title: document.title,
        path: document.path,
        text: document.text,
        chunkIndex: document.chunkIndex
      }
    });
  }

  for (let start = 0; start < vectors.length; start += 100) {
    await cloudflareVectorizeRequest('', {
      method: 'POST',
      body: JSON.stringify({ vectors: vectors.slice(start, start + 100) })
    }, env);
  }
}

async function main() {
  const documents = await buildEchoDocuments(process.cwd());
  console.log(`Prepared ${documents.length} Echo documents for ECHO_VECTORIZE.`);
  console.log('Default embedding model:', process.env.ECHO_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL);

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

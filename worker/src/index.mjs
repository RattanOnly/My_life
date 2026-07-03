const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...init.headers
  }
});

const VISITOR_LOG_RETENTION_DAYS = 30;
const ONLINE_VISITOR_WINDOW_MINUTES = 3;
const MAX_VISITED_PAGE_LENGTH = 512;
const MAX_DEVICE_SUMMARY_LENGTH = 80;
const MAX_VISITOR_LOCATION_LENGTH = 160;
const MAX_VISITOR_ID_LENGTH = 160;
const MAX_COMMENT_NAME_LENGTH = 80;
const MAX_COMMENT_EMAIL_LENGTH = 160;
const MAX_COMMENT_BODY_LENGTH = 2000;
const DEFAULT_VISITOR_LOG_PAGE_SIZE = 20;
const MAX_VISITOR_LOG_PAGE_SIZE = 100;
const DEFAULT_COMMENT_PAGE_SIZE = 20;
const MAX_COMMENT_PAGE_SIZE = 100;
const COMMENT_DELETION_WINDOW_MINUTES = 10;
const COMMENT_DELETE_TOKEN_BYTES = 24;
const PUBLIC_CORS_PATHS = new Set(['/visits', '/presence', '/online-count', '/comments']);
const PUBLIC_CORS_ORIGINS = new Set([
  'https://lovezvv.com',
  'https://www.lovezvv.com',
  'http://localhost:4000',
  'http://127.0.0.1:4000'
]);
const COUNTRY_NAMES = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
  US: '美国',
  CA: '加拿大',
  GB: '英国',
  JP: '日本',
  KR: '韩国',
  SG: '新加坡',
  AU: '澳大利亚',
  DE: '德国',
  FR: '法国'
};

function requireVisitorDb(env) {
  if (!env?.VISITOR_DB) {
    throw new Error('VISITOR_DB binding is missing');
  }

  return env.VISITOR_DB;
}

function isAuthorizedAdmin(request, env) {
  const expected = env?.ADMIN_PASSWORD;
  if (!expected) return false;

  return request.headers.get('authorization') === `Bearer ${expected}`;
}

function unauthorized() {
  return json({ error: 'Unauthorized' }, { status: 401 });
}

function publicCorsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  if (!PUBLIC_CORS_ORIGINS.has(origin)) {
    return {};
  }

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-allow-headers': 'content-type',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function isPublicCorsPath(pathname) {
  return PUBLIC_CORS_PATHS.has(pathname) || /^\/comments\/\d+$/.test(pathname);
}

function withPublicCors(response, request) {
  const headers = new Headers(response.headers);
  Object.entries(publicCorsHeaders(request)).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function handlePublicCorsOptions(request) {
  return new Response(null, {
    status: 204,
    headers: publicCorsHeaders(request)
  });
}

async function handleHealth(env) {
  if (!env?.VISITOR_DB) {
    return json({
      ok: false,
      service: 'visitor-state-sidecar',
      database: 'missing-binding'
    }, { status: 500 });
  }

  await env.VISITOR_DB.prepare('SELECT 1 AS ok').first();

  return json({
    ok: true,
    service: 'visitor-state-sidecar',
    database: 'reachable'
  });
}

async function readJson(request) {
  if (!request.body) {
    return {};
  }

  try {
    return await request.json();
  } catch {
    return {};
  }
}

function getVisitorIp(request) {
  return request.headers.get('cf-connecting-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);

  return [...new Uint8Array(digest)]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function getVisitorKey(request) {
  return sha256Hex([
    getVisitorIp(request),
    request.headers.get('user-agent') || 'unknown'
  ].join('|'));
}

async function getPresenceVisitorKey(request, body) {
  const visitorId = cleanText(body.visitorId, MAX_VISITOR_ID_LENGTH);
  if (visitorId) {
    return sha256Hex(`browser:${visitorId}`);
  }

  return getVisitorKey(request);
}

function normalizeVisitedPage(path) {
  if (typeof path !== 'string' || path.trim() === '') {
    return '/';
  }

  let parsed;
  try {
    parsed = new URL(path, 'https://blog.local');
  } catch {
    return '/';
  }

  const visitedPage = `${parsed.pathname}${parsed.search}`;
  return visitedPage.slice(0, MAX_VISITED_PAGE_LENGTH);
}

function normalizeArticlePath(path) {
  if (typeof path !== 'string' || path.trim() === '') {
    return '';
  }

  let parsed;
  try {
    parsed = new URL(path, 'https://blog.local');
  } catch {
    return '';
  }

  return parsed.pathname.slice(0, MAX_VISITED_PAGE_LENGTH);
}

function normalizeArticlePaths(paths) {
  const normalized = [];
  const seen = new Set();

  paths.forEach(path => {
    const articlePath = normalizeArticlePath(path);
    if (!articlePath || seen.has(articlePath)) return;
    seen.add(articlePath);
    normalized.push(articlePath);
  });

  return normalized;
}

function readCommentPathAliases(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return [];
  }

  return value.split(',').map(alias => alias.trim()).filter(Boolean).slice(0, 10);
}

function cleanText(value, maxLength) {
  if (typeof value !== 'string') {
    return '';
  }

  return value.trim().slice(0, maxLength);
}

function cleanIpAddress(value) {
  return cleanText(value, 80);
}

function readCommentId(value) {
  const number = Number.parseInt(value, 10);
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function createDeleteToken() {
  const bytes = new Uint8Array(COMMENT_DELETE_TOKEN_BYTES);
  crypto.getRandomValues(bytes);

  return [...bytes]
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function readPositiveInteger(value, fallback, maxValue) {
  const number = Number.parseInt(value, 10);
  if (!Number.isInteger(number) || number <= 0) return fallback;
  return maxValue ? Math.min(number, maxValue) : number;
}

function parseDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function readVisitorLogQuery(url) {
  const pageSize = readPositiveInteger(
    url.searchParams.get('visitorPageSize'),
    DEFAULT_VISITOR_LOG_PAGE_SIZE,
    MAX_VISITOR_LOG_PAGE_SIZE
  );
  const page = readPositiveInteger(url.searchParams.get('visitorPage'), 1);
  const owner = cleanText(url.searchParams.get('visitorOwner'), 20);
  const pageKeyword = cleanText(url.searchParams.get('visitorPageKeyword'), MAX_VISITED_PAGE_LENGTH);
  const fromDate = parseDateOnly(url.searchParams.get('visitorFrom'));
  const toDate = parseDateOnly(url.searchParams.get('visitorTo'));

  return {
    page,
    pageSize,
    owner: ['owner', 'visitor'].includes(owner) ? owner : '',
    pageKeyword,
    from: fromDate ? fromDate.toISOString() : '',
    to: toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : ''
  };
}

function buildVisitorLogFilter(query) {
  const clauses = [];
  const values = [];

  if (query.from) {
    values.push(query.from);
    clauses.push(`visitor_logs.visited_at >= ?${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    clauses.push(`visitor_logs.visited_at < ?${values.length}`);
  }

  if (query.pageKeyword) {
    values.push(`%${query.pageKeyword}%`);
    clauses.push(`visitor_logs.visited_page LIKE ?${values.length}`);
  }

  if (query.owner === 'owner') {
    clauses.push('owner_ip_marks.ip_address IS NOT NULL');
  } else if (query.owner === 'visitor') {
    clauses.push('owner_ip_marks.ip_address IS NULL');
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values
  };
}

function readCommentQuery(url) {
  const pageSize = readPositiveInteger(
    url.searchParams.get('commentPageSize'),
    DEFAULT_COMMENT_PAGE_SIZE,
    MAX_COMMENT_PAGE_SIZE
  );
  const page = readPositiveInteger(url.searchParams.get('commentPage'), 1);
  const articlePathKeyword = cleanText(
    url.searchParams.get('commentArticlePathKeyword'),
    MAX_VISITED_PAGE_LENGTH
  );
  const keyword = cleanText(url.searchParams.get('commentKeyword'), 200);
  const fromDate = parseDateOnly(url.searchParams.get('commentFrom'));
  const toDate = parseDateOnly(url.searchParams.get('commentTo'));

  return {
    page,
    pageSize,
    articlePathKeyword,
    keyword,
    from: fromDate ? fromDate.toISOString() : '',
    to: toDate ? new Date(toDate.getTime() + 24 * 60 * 60 * 1000).toISOString() : ''
  };
}

function buildCommentFilter(query) {
  const clauses = [];
  const values = [];

  if (query.from) {
    values.push(query.from);
    clauses.push(`created_at >= ?${values.length}`);
  }

  if (query.to) {
    values.push(query.to);
    clauses.push(`created_at < ?${values.length}`);
  }

  if (query.articlePathKeyword) {
    values.push(`%${query.articlePathKeyword}%`);
    clauses.push(`article_path LIKE ?${values.length}`);
  }

  if (query.keyword) {
    values.push(`%${query.keyword}%`);
    const namePlaceholder = `?${values.length}`;
    values.push(`%${query.keyword}%`);
    const bodyPlaceholder = `?${values.length}`;
    clauses.push(`(comment_name LIKE ${namePlaceholder} OR comment_body LIKE ${bodyPlaceholder})`);
  }

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    values
  };
}

function summarizeBrowser(userAgent) {
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/Chrome\//.test(userAgent) && !/Chromium/.test(userAgent)) return 'Chrome';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Version\/.*Safari\//.test(userAgent) || /Safari\//.test(userAgent)) return 'Safari';

  return 'Unknown browser';
}

function summarizeOs(userAgent) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows NT/.test(userAgent)) return 'Windows';
  if (/Mac OS X|Macintosh/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';

  return 'Unknown OS';
}

function summarizeDevice(userAgent) {
  if (!userAgent) {
    return 'Unknown browser on Unknown OS';
  }

  const summary = `${summarizeBrowser(userAgent)} on ${summarizeOs(userAgent)}`;
  return summary.slice(0, MAX_DEVICE_SUMMARY_LENGTH);
}

function summarizeVisitorLocation(cf = {}) {
  const country = COUNTRY_NAMES[cf.country] || cf.country;
  const parts = [country, cf.region, cf.city]
    .map(value => cleanText(value || '', 80))
    .filter(Boolean);

  return (parts.length ? parts.join(' · ') : '未知地区').slice(0, MAX_VISITOR_LOCATION_LENGTH);
}

async function handleVisit(request, env) {
  const db = requireVisitorDb(env);
  const body = await readJson(request);
  const ipAddress = getVisitorIp(request);
  const visitedAt = new Date().toISOString();
  const visitedPage = normalizeVisitedPage(body.path);
  const visitorDeviceSummary = summarizeDevice(request.headers.get('user-agent') || '');
  const visitorLocation = summarizeVisitorLocation(request.cf || {});

  await db.prepare(`
    INSERT INTO visitor_logs (
      ip_address,
      visited_at,
      visited_page,
      visitor_device_summary,
      visitor_location
    )
    VALUES (?1, ?2, ?3, ?4, ?5)
  `).bind(
    ipAddress,
    visitedAt,
    visitedPage,
    visitorDeviceSummary,
    visitorLocation
  ).run();

  return new Response(null, { status: 204 });
}

async function handlePresence(request, env) {
  const db = requireVisitorDb(env);
  const body = await readJson(request);
  const visitorKey = await getPresenceVisitorKey(request, body);
  const lastSeenAt = new Date().toISOString();

  await db.prepare(`
    INSERT INTO visitor_presence (
      visitor_key,
      last_seen_at
    )
    VALUES (?1, ?2)
    ON CONFLICT(visitor_key) DO UPDATE SET
      last_seen_at = excluded.last_seen_at
  `).bind(visitorKey, lastSeenAt).run();

  return new Response(null, { status: 204 });
}

async function handleOnlineCount(env, now = new Date()) {
  const db = requireVisitorDb(env);
  const count = await readOnlineCount(db, now);

  return json({ count });
}

async function readOnlineCount(db, now = new Date()) {
  const activeSince = new Date(now.getTime() - ONLINE_VISITOR_WINDOW_MINUTES * 60 * 1000);
  const row = await db.prepare(`
    SELECT COUNT(*) AS count
    FROM visitor_presence
    WHERE last_seen_at >= ?1
  `).bind(activeSince.toISOString()).first();

  return Number(row?.count || 0);
}

function privateVisitorLog(row) {
  return {
    id: Number(row.id),
    ipAddress: row.ip_address,
    visitedAt: row.visited_at,
    visitedPage: row.visited_page,
    visitorDeviceSummary: row.visitor_device_summary,
    visitorLocation: row.visitor_location || '未知地区',
    isOwnerVisitor: Boolean(row.is_owner_visitor)
  };
}

async function handleAdminData(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const db = requireVisitorDb(env);
  const url = new URL(request.url);
  const visitorLogQuery = readVisitorLogQuery(url);
  const visitorLogFilter = buildVisitorLogFilter(visitorLogQuery);
  const onlineCount = await readOnlineCount(db);
  const totalRow = await db.prepare(`
    SELECT COUNT(*) AS total_count
    FROM visitor_logs
    LEFT JOIN owner_ip_marks ON owner_ip_marks.ip_address = visitor_logs.ip_address
    ${visitorLogFilter.whereSql}
  `).bind(...visitorLogFilter.values).first();
  const total = Number(totalRow?.total_count || 0);
  const totalPages = Math.max(1, Math.ceil(total / visitorLogQuery.pageSize));
  const page = Math.min(visitorLogQuery.page, totalPages);
  const offset = (page - 1) * visitorLogQuery.pageSize;
  const result = await db.prepare(`
    SELECT
      visitor_logs.id,
      visitor_logs.ip_address,
      visitor_logs.visited_at,
      visitor_logs.visited_page,
      visitor_logs.visitor_device_summary,
      COALESCE(visitor_logs.visitor_location, '未知地区') AS visitor_location,
      owner_ip_marks.ip_address IS NOT NULL AS is_owner_visitor
    FROM visitor_logs
    LEFT JOIN owner_ip_marks ON owner_ip_marks.ip_address = visitor_logs.ip_address
    ${visitorLogFilter.whereSql}
    ORDER BY visitor_logs.visited_at DESC, visitor_logs.id DESC
    LIMIT ?${visitorLogFilter.values.length + 1}
    OFFSET ?${visitorLogFilter.values.length + 2}
  `).bind(...visitorLogFilter.values, visitorLogQuery.pageSize, offset).all();

  return json({
    onlineCount,
    visitorLogs: (result.results || []).map(privateVisitorLog),
    visitorLogsPagination: {
      page,
      pageSize: visitorLogQuery.pageSize,
      total,
      totalPages
    }
  });
}

async function handleMarkOwnerIp(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const body = await readJson(request);
  const ipAddress = cleanIpAddress(body.ipAddress);
  if (!ipAddress) {
    return json({ error: 'IP address is required' }, { status: 400 });
  }

  const db = requireVisitorDb(env);
  await db.prepare(`
    INSERT INTO owner_ip_marks (
      ip_address,
      created_at
    )
    VALUES (?1, ?2)
    ON CONFLICT(ip_address) DO UPDATE SET
      created_at = excluded.created_at
  `).bind(ipAddress, new Date().toISOString()).run();

  return new Response(null, { status: 204 });
}

async function handleUnmarkOwnerIp(request, env, ipAddress) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const cleanIp = cleanIpAddress(ipAddress);
  if (!cleanIp) {
    return json({ error: 'IP address is required' }, { status: 400 });
  }

  const db = requireVisitorDb(env);
  await db.prepare(`
    DELETE FROM owner_ip_marks
    WHERE ip_address = ?1
  `).bind(cleanIp).run();

  return new Response(null, { status: 204 });
}

async function handleClearVisitorLogs(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const db = requireVisitorDb(env);
  await db.prepare(`
    DELETE FROM visitor_logs
  `).run();

  return new Response(null, { status: 204 });
}

function publicComment(row) {
  if (row.deleted_at) {
    return {
      id: Number(row.id),
      parentId: row.parent_comment_id ? Number(row.parent_comment_id) : null,
      name: '评论已删除',
      body: '评论已删除',
      createdAt: row.created_at,
      isDeleted: true
    };
  }

  return {
    id: Number(row.id),
    parentId: row.parent_comment_id ? Number(row.parent_comment_id) : null,
    name: row.comment_name,
    body: row.comment_body,
    createdAt: row.created_at
  };
}

function privateComment(row) {
  return {
    id: Number(row.id),
    articlePath: row.article_path,
    parentId: row.parent_comment_id ? Number(row.parent_comment_id) : null,
    name: row.comment_name,
    email: row.comment_email,
    body: row.comment_body,
    createdAt: row.created_at
  };
}

async function handleListComments(request, env) {
  const db = requireVisitorDb(env);
  const url = new URL(request.url);
  const articlePath = normalizeArticlePath(url.searchParams.get('path'));
  const articlePaths = normalizeArticlePaths([
    articlePath,
    ...readCommentPathAliases(url.searchParams.get('aliases'))
  ]);

  if (!articlePaths.length) {
    return json({ error: 'Article path is required' }, { status: 400 });
  }

  const placeholders = articlePaths.map((_, index) => `?${index + 1}`).join(',');
  const result = await db.prepare(`
    SELECT id, parent_comment_id, comment_name, comment_body, deleted_at, created_at
    FROM article_comments
    WHERE article_path IN (${placeholders})
    ORDER BY created_at ASC, id ASC
    LIMIT 100
  `).bind(...articlePaths).all();

  return json({
    comments: (result.results || []).map(publicComment)
  });
}

async function handleCreateComment(request, env) {
  const db = requireVisitorDb(env);
  const body = await readJson(request);
  const articlePath = normalizeArticlePath(body.path);
  const commentName = cleanText(body.name, MAX_COMMENT_NAME_LENGTH);
  const commentEmail = cleanText(body.email, MAX_COMMENT_EMAIL_LENGTH) || null;
  const commentBody = cleanText(body.body, MAX_COMMENT_BODY_LENGTH);
  const requestedParentId = readCommentId(body.parentId);
  const createdAt = new Date().toISOString();
  const deleteToken = createDeleteToken();
  const deleteTokenHash = await sha256Hex(deleteToken);
  const canDeleteUntil = new Date(
    new Date(createdAt).getTime() + COMMENT_DELETION_WINDOW_MINUTES * 60 * 1000
  ).toISOString();

  if (!articlePath) {
    return json({ error: 'Article path is required' }, { status: 400 });
  }

  if (!commentName) {
    return json({ error: 'Comment Name is required' }, { status: 400 });
  }

  if (!commentBody) {
    return json({ error: 'Comment body is required' }, { status: 400 });
  }

  let parentCommentId = null;
  if (requestedParentId) {
    const parentComment = await db.prepare(`
      SELECT id, parent_comment_id
      FROM article_comments
      WHERE id = ?1
    `).bind(requestedParentId).first();

    if (!parentComment) {
      return json({ error: 'Parent comment not found' }, { status: 400 });
    }

    parentCommentId = Number(parentComment.parent_comment_id || parentComment.id);
  }

  const result = await db.prepare(`
    INSERT INTO article_comments (
      article_path,
      comment_name,
      comment_email,
      comment_body,
      created_at,
      parent_comment_id,
      delete_token_hash
    )
    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
  `).bind(
    articlePath,
    commentName,
    commentEmail,
    commentBody,
    createdAt,
    parentCommentId,
    deleteTokenHash
  ).run();

  return json({
    comment: {
      id: Number(result.meta?.last_row_id || 0),
      parentId: parentCommentId,
      name: commentName,
      body: commentBody,
      createdAt,
      deleteToken,
      canDeleteUntil
    }
  }, { status: 201 });
}

async function deleteOrMarkComment(db, commentId, deletedAt = new Date().toISOString()) {
  const replyCountRow = await db.prepare(`
    SELECT COUNT(*) AS reply_count
    FROM article_comments
    WHERE parent_comment_id = ?1
  `).bind(commentId).first();

  if (Number(replyCountRow?.reply_count || 0) > 0) {
    await db.prepare(`
      UPDATE article_comments
      SET
        comment_name = '评论已删除',
        comment_email = NULL,
        comment_body = '评论已删除',
        deleted_at = ?2
      WHERE id = ?1
    `).bind(commentId, deletedAt).run();
    return;
  }

  await db.prepare(`
    DELETE FROM article_comments
    WHERE id = ?1
  `).bind(commentId).run();
}

async function handleDeleteComment(request, env, id) {
  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return json({ error: 'Invalid comment id' }, { status: 400 });
  }

  const body = await readJson(request);
  const deleteToken = cleanText(body.deleteToken, 256);
  if (!deleteToken) {
    return json({ error: 'Delete token is required' }, { status: 403 });
  }

  const db = requireVisitorDb(env);
  const comment = await db.prepare(`
    SELECT id, created_at, delete_token_hash
    FROM article_comments
    WHERE id = ?1
  `).bind(commentId).first();

  if (!comment) {
    return json({ error: 'Comment not found' }, { status: 404 });
  }

  if (!comment.delete_token_hash || await sha256Hex(deleteToken) !== comment.delete_token_hash) {
    return json({ error: 'Invalid delete token' }, { status: 403 });
  }

  const createdAt = new Date(comment.created_at);
  const expiresAt = new Date(createdAt.getTime() + COMMENT_DELETION_WINDOW_MINUTES * 60 * 1000);
  if (Number.isNaN(createdAt.getTime()) || expiresAt <= new Date()) {
    return json({ error: 'Comment deletion window has expired' }, { status: 410 });
  }

  await deleteOrMarkComment(db, commentId);

  return new Response(null, { status: 204 });
}

async function handleAdminListComments(request, env) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const db = requireVisitorDb(env);
  const url = new URL(request.url);
  const commentQuery = readCommentQuery(url);
  const commentFilter = buildCommentFilter(commentQuery);
  const totalRow = await db.prepare(`
    SELECT COUNT(*) AS total_count
    FROM article_comments
    ${commentFilter.whereSql}
  `).bind(...commentFilter.values).first();
  const total = Number(totalRow?.total_count || 0);
  const totalPages = Math.max(1, Math.ceil(total / commentQuery.pageSize));
  const page = Math.min(commentQuery.page, totalPages);
  const offset = (page - 1) * commentQuery.pageSize;
  const result = await db.prepare(`
    SELECT id, article_path, parent_comment_id, comment_name, comment_email, comment_body, created_at
    FROM article_comments
    ${commentFilter.whereSql}
    ORDER BY created_at DESC, id DESC
    LIMIT ?${commentFilter.values.length + 1}
    OFFSET ?${commentFilter.values.length + 2}
  `).bind(...commentFilter.values, commentQuery.pageSize, offset).all();

  return json({
    comments: (result.results || []).map(privateComment),
    commentsPagination: {
      page,
      pageSize: commentQuery.pageSize,
      total,
      totalPages
    }
  });
}

async function handleAdminDeleteComment(request, env, id) {
  if (!isAuthorizedAdmin(request, env)) return unauthorized();

  const commentId = Number(id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    return json({ error: 'Invalid comment id' }, { status: 400 });
  }

  const db = requireVisitorDb(env);
  await deleteOrMarkComment(db, commentId);

  return new Response(null, { status: 204 });
}

async function cleanupVisitorLogs(env, now = new Date()) {
  const db = requireVisitorDb(env);
  const cutoff = new Date(now.getTime() - VISITOR_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await db.prepare(`
    DELETE FROM visitor_logs
    WHERE visited_at < ?1
  `).bind(cutoff.toISOString()).run();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS' && isPublicCorsPath(url.pathname)) {
      return handlePublicCorsOptions(request);
    }

    if (request.method === 'GET' && url.pathname === '/health') {
      return handleHealth(env);
    }

    if (request.method === 'POST' && url.pathname === '/visits') {
      return withPublicCors(await handleVisit(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === '/presence') {
      return withPublicCors(await handlePresence(request, env), request);
    }

    if (request.method === 'GET' && url.pathname === '/online-count') {
      return withPublicCors(await handleOnlineCount(env), request);
    }

    if (request.method === 'GET' && url.pathname === '/admin-data') {
      return handleAdminData(request, env);
    }

    if (request.method === 'POST' && url.pathname === '/admin-owner-ip-marks') {
      return handleMarkOwnerIp(request, env);
    }

    const ownerIpDeleteMatch = url.pathname.match(/^\/admin-owner-ip-marks\/(.+)$/);
    if (request.method === 'DELETE' && ownerIpDeleteMatch) {
      return handleUnmarkOwnerIp(request, env, decodeURIComponent(ownerIpDeleteMatch[1]));
    }

    if (request.method === 'DELETE' && url.pathname === '/admin-visits') {
      return handleClearVisitorLogs(request, env);
    }

    if (request.method === 'GET' && url.pathname === '/comments') {
      return withPublicCors(await handleListComments(request, env), request);
    }

    if (request.method === 'POST' && url.pathname === '/comments') {
      return withPublicCors(await handleCreateComment(request, env), request);
    }

    const publicCommentDeleteMatch = url.pathname.match(/^\/comments\/(\d+)$/);
    if (request.method === 'DELETE' && publicCommentDeleteMatch) {
      return withPublicCors(await handleDeleteComment(request, env, publicCommentDeleteMatch[1]), request);
    }

    if (request.method === 'GET' && url.pathname === '/admin-comments') {
      return handleAdminListComments(request, env);
    }

    const adminCommentDeleteMatch = url.pathname.match(/^\/admin-comments\/(\d+)$/);
    if (request.method === 'DELETE' && adminCommentDeleteMatch) {
      return handleAdminDeleteComment(request, env, adminCommentDeleteMatch[1]);
    }

    return json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(event, env) {
    await cleanupVisitorLogs(env, new Date(event.scheduledTime));
  }
};

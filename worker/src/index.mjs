const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...init.headers
  }
});

const VISITOR_LOG_RETENTION_DAYS = 90;
const MAX_VISITED_PAGE_LENGTH = 512;
const MAX_DEVICE_SUMMARY_LENGTH = 80;

function requireVisitorDb(env) {
  if (!env?.VISITOR_DB) {
    throw new Error('VISITOR_DB binding is missing');
  }

  return env.VISITOR_DB;
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

async function handleVisit(request, env) {
  const db = requireVisitorDb(env);
  const body = await readJson(request);
  const ipAddress = getVisitorIp(request);
  const visitedAt = new Date().toISOString();
  const visitedPage = normalizeVisitedPage(body.path);
  const visitorDeviceSummary = summarizeDevice(request.headers.get('user-agent') || '');

  await db.prepare(`
    INSERT INTO visitor_logs (
      ip_address,
      visited_at,
      visited_page,
      visitor_device_summary
    )
    VALUES (?1, ?2, ?3, ?4)
  `).bind(
    ipAddress,
    visitedAt,
    visitedPage,
    visitorDeviceSummary
  ).run();

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

    if (request.method === 'GET' && url.pathname === '/health') {
      return handleHealth(env);
    }

    if (request.method === 'POST' && url.pathname === '/visits') {
      return handleVisit(request, env);
    }

    return json({ error: 'Not found' }, { status: 404 });
  },

  async scheduled(event, env) {
    await cleanupVisitorLogs(env, new Date(event.scheduledTime));
  }
};

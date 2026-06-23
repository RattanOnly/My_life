const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    'content-type': 'application/json',
    ...init.headers
  }
});

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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/health') {
      return handleHealth(env);
    }

    return json({ error: 'Not found' }, { status: 404 });
  }
};

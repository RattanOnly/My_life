(() => {
  const container = document.getElementById('visitor-online-count');
  if (!container || window.__visitorOnlineInitialized) return;
  window.__visitorOnlineInitialized = true;

  const countEl = container.querySelector('[data-count]');
  const countEndpoint = container.dataset.endpoint || '/online-count';
  const presenceEndpoint = container.dataset.presenceEndpoint || '/presence';
  const visitEndpoint = container.dataset.visitEndpoint || '/visits';
  const intervalMs = Math.max(Number(container.dataset.heartbeatIntervalMs) || 60000, 30000);
  let lastRecordedPath = '';

  const markUnavailable = () => {
    container.dataset.status = 'unavailable';
  };

  const updateCount = count => {
    if (!countEl || !Number.isFinite(count)) return;
    countEl.textContent = String(Math.max(0, count));
    container.dataset.status = 'ready';
  };

  const sendPresence = async () => {
    await fetch(presenceEndpoint, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true
    });
  };

  const currentPagePath = () => `${window.location.pathname}${window.location.search}`;

  const recordVisit = async () => {
    const path = currentPagePath();
    if (!path || path === lastRecordedPath) return;

    const response = await fetch(visitEndpoint, {
      method: 'POST',
      credentials: 'omit',
      keepalive: true,
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({ path })
    });

    if (response.ok) {
      lastRecordedPath = path;
    }
  };

  const refreshCount = async () => {
    const response = await fetch(countEndpoint, {
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!response.ok) {
      markUnavailable();
      return;
    }
    const body = await response.json();
    updateCount(Number(body.count));
  };

  const heartbeat = async () => {
    try {
      recordVisit().catch(() => {});
      await sendPresence();
      await refreshCount();
    } catch (error) {
      markUnavailable();
    }
  };

  heartbeat();
  window.setInterval(heartbeat, intervalMs);

  if (window.addEventListener) {
    window.addEventListener('pjax:success', heartbeat);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) heartbeat();
    });
  }
})();

(() => {
  const root = document.getElementById('admin-dashboard');
  if (!root || window.__adminDashboardInitialized) return;
  window.__adminDashboardInitialized = true;

  const loginForm = root.querySelector('[data-admin-login]');
  const status = root.querySelector('[data-admin-status]');
  const content = root.querySelector('[data-admin-content]');
  const onlineCount = root.querySelector('[data-admin-online-count]');
  const visitorLogs = root.querySelector('[data-admin-visitor-logs]');
  const visitorFilters = root.querySelector('[data-admin-visitor-filters]');
  const visitorFilterResetButton = root.querySelector('[data-admin-visitor-filter-reset]');
  const visitorPagePrevButton = root.querySelector('[data-admin-visitor-page-prev]');
  const visitorPageNextButton = root.querySelector('[data-admin-visitor-page-next]');
  const visitorPageSummary = root.querySelector('[data-admin-visitor-page-summary]');
  const commentFilters = root.querySelector('[data-admin-comment-filters]');
  const commentFilterResetButton = root.querySelector('[data-admin-comment-filter-reset]');
  const commentPagePrevButton = root.querySelector('[data-admin-comment-page-prev]');
  const commentPageNextButton = root.querySelector('[data-admin-comment-page-next]');
  const commentPageSummary = root.querySelector('[data-admin-comment-page-summary]');
  const comments = root.querySelector('[data-admin-comments]');
  const refreshButton = root.querySelector('[data-admin-refresh]');
  const logoutButton = root.querySelector('[data-admin-logout]');
  const clearVisitsButton = root.querySelector('[data-admin-clear-visits]');
  const echoEnabled = root.querySelector('[data-admin-echo-enabled]');
  const echoToggleButton = root.querySelector('[data-admin-echo-toggle]');
  const echoUsage = root.querySelector('[data-admin-echo-usage]');
  const adminDataEndpoint = root.dataset.adminDataEndpoint || '/admin-data';
  const adminCommentsEndpoint = root.dataset.adminCommentsEndpoint || '/admin-comments';
  const adminOwnerIpMarksEndpoint = root.dataset.adminOwnerIpMarksEndpoint || '/admin-owner-ip-marks';
  const adminClearVisitsEndpoint = root.dataset.adminClearVisitsEndpoint || '/admin-visits';
  const adminEchoStatusEndpoint = root.dataset.adminEchoStatusEndpoint || '/admin-echo';
  const adminEchoUsageEndpoint = root.dataset.adminEchoUsageEndpoint || '/admin-echo-usage';
  const PASSWORD_STORAGE_KEY = 'admin_dashboard_password';

  let adminPassword = '';
  let echoIsEnabled = true;
  const visitorFilterState = {
    visitorPage: 1,
    visitorPageSize: 20,
    visitorFrom: '',
    visitorTo: '',
    visitorOwner: '',
    visitorPageKeyword: ''
  };
  const commentFilterState = {
    commentPage: 1,
    commentPageSize: 20,
    commentFrom: '',
    commentTo: '',
    commentArticlePathKeyword: '',
    commentKeyword: ''
  };

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  const adminHeaders = () => ({
    Authorization: `Bearer ${adminPassword}`
  });

  const clearNode = node => {
    if (node) node.textContent = '';
  };

  const appendCell = (row, value) => {
    const cell = document.createElement('td');
    cell.textContent = value || '';
    row.append(cell);
  };

  const appendActionCell = (row, child) => {
    const cell = document.createElement('td');
    if (child) cell.append(child);
    row.append(cell);
  };

  const formatVisitorLocation = log => {
    if (log.visitorLocation && log.visitorLocation !== '未知地区') return log.visitorLocation;
    return log.isOwnerVisitor ? '本机' : '未知地区';
  };

  const formatVisitedPage = path => {
    if (!path) return '';

    try {
      return decodeURI(path);
    } catch {
      return path;
    }
  };

  const adminFetch = async (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      ...adminHeaders(),
      ...options.headers
    }
  });

  const buildAdminDataUrl = () => {
    const params = new URLSearchParams();
    params.set('visitorPage', String(visitorFilterState.visitorPage));
    params.set('visitorPageSize', String(visitorFilterState.visitorPageSize));
    ['visitorFrom', 'visitorTo', 'visitorOwner', 'visitorPageKeyword'].forEach(key => {
      if (visitorFilterState[key]) params.set(key, visitorFilterState[key]);
    });

    return `${adminDataEndpoint}?${params.toString()}`;
  };

  const buildAdminCommentsUrl = () => {
    const params = new URLSearchParams();
    params.set('commentPage', String(commentFilterState.commentPage));
    params.set('commentPageSize', String(commentFilterState.commentPageSize));
    ['commentFrom', 'commentTo', 'commentArticlePathKeyword', 'commentKeyword'].forEach(key => {
      if (commentFilterState[key]) params.set(key, commentFilterState[key]);
    });

    return `${adminCommentsEndpoint}?${params.toString()}`;
  };

  const readVisitorFilters = () => {
    if (!visitorFilters) return;

    const formData = new FormData(visitorFilters);
    visitorFilterState.visitorFrom = String(formData.get('visitorFrom') || '');
    visitorFilterState.visitorTo = String(formData.get('visitorTo') || '');
    visitorFilterState.visitorOwner = String(formData.get('visitorOwner') || '');
    visitorFilterState.visitorPageKeyword = String(formData.get('visitorPageKeyword') || '').trim();
    visitorFilterState.visitorPage = 1;
  };

  const resetVisitorFilters = () => {
    if (visitorFilters) visitorFilters.reset();
    visitorFilterState.visitorPage = 1;
    visitorFilterState.visitorFrom = '';
    visitorFilterState.visitorTo = '';
    visitorFilterState.visitorOwner = '';
    visitorFilterState.visitorPageKeyword = '';
  };

  const readCommentFilters = () => {
    if (!commentFilters) return;

    const formData = new FormData(commentFilters);
    commentFilterState.commentFrom = String(formData.get('commentFrom') || '');
    commentFilterState.commentTo = String(formData.get('commentTo') || '');
    commentFilterState.commentArticlePathKeyword = String(formData.get('commentArticlePathKeyword') || '').trim();
    commentFilterState.commentKeyword = String(formData.get('commentKeyword') || '').trim();
    commentFilterState.commentPage = 1;
  };

  const resetCommentFilters = () => {
    if (commentFilters) commentFilters.reset();
    commentFilterState.commentPage = 1;
    commentFilterState.commentFrom = '';
    commentFilterState.commentTo = '';
    commentFilterState.commentArticlePathKeyword = '';
    commentFilterState.commentKeyword = '';
  };

  const renderVisitorPagination = pagination => {
    const page = Number(pagination?.page || 1);
    const pageSize = Number(pagination?.pageSize || visitorFilterState.visitorPageSize);
    const total = Number(pagination?.total || 0);
    const totalPages = Number(pagination?.totalPages || 1);
    visitorFilterState.visitorPage = page;
    visitorFilterState.visitorPageSize = pageSize;

    if (visitorPageSummary) {
      visitorPageSummary.textContent = `第 ${page} / ${totalPages} 页，共 ${total} 条`;
    }

    if (visitorPagePrevButton) visitorPagePrevButton.disabled = page <= 1;
    if (visitorPageNextButton) visitorPageNextButton.disabled = page >= totalPages;
  };

  const renderCommentPagination = pagination => {
    const page = Number(pagination?.page || 1);
    const pageSize = Number(pagination?.pageSize || commentFilterState.commentPageSize);
    const total = Number(pagination?.total || 0);
    const totalPages = Number(pagination?.totalPages || 1);
    commentFilterState.commentPage = page;
    commentFilterState.commentPageSize = pageSize;

    if (commentPageSummary) {
      commentPageSummary.textContent = `第 ${page} / ${totalPages} 页，共 ${total} 条`;
    }

    if (commentPagePrevButton) commentPagePrevButton.disabled = page <= 1;
    if (commentPageNextButton) commentPageNextButton.disabled = page >= totalPages;
  };

  const markOwnerIp = async ipAddress => {
    if (!ipAddress) return;

    const response = await adminFetch(adminOwnerIpMarksEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ipAddress })
    });

    if (!response.ok) {
      setStatus('标记本机失败。');
      return;
    }

    await loadDashboard();
    setStatus('已标记本机。');
  };

  const unmarkOwnerIp = async ipAddress => {
    if (!ipAddress) return;

    const response = await adminFetch(`${adminOwnerIpMarksEndpoint}/${encodeURIComponent(ipAddress)}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      setStatus('取消本机失败。');
      return;
    }

    await loadDashboard();
    setStatus('已取消本机。');
  };

  const clearVisitorLogs = async () => {
    if (!window.confirm('确定清空最近访问吗？评论和在线人数不会受影响。')) return;

    const response = await adminFetch(adminClearVisitsEndpoint, {
      method: 'DELETE'
    });

    if (!response.ok) {
      setStatus('清空最近访问失败。');
      return;
    }

    await loadDashboard();
    setStatus('最近访问已清空。');
  };

  const renderVisitorLogs = logs => {
    clearNode(visitorLogs);
    if (!logs.length) {
      const row = document.createElement('tr');
      const cell = document.createElement('td');
      cell.colSpan = 6;
      cell.className = 'admin-empty-cell';
      cell.textContent = '暂无最近访问。';
      row.append(cell);
      visitorLogs.append(row);
      return;
    }

    logs.forEach(log => {
      const row = document.createElement('tr');
      appendCell(row, log.visitedAt ? new Date(log.visitedAt).toLocaleString() : '');
      appendCell(row, log.isOwnerVisitor ? '本机' : log.ipAddress);
      appendCell(row, formatVisitorLocation(log));
      appendCell(row, formatVisitedPage(log.visitedPage));
      appendCell(row, log.visitorDeviceSummary);
      const actionButton = document.createElement('button');
      actionButton.type = 'button';
      actionButton.textContent = log.isOwnerVisitor ? '取消本机' : '标记本机';
      actionButton.addEventListener('click', () => {
        const action = log.isOwnerVisitor ? unmarkOwnerIp : markOwnerIp;
        action(log.ipAddress).catch(() => {
          setStatus('操作失败。');
        });
      });
      appendActionCell(row, actionButton);
      visitorLogs.append(row);
    });
  };

  const deleteComment = async id => {
    const response = await fetch(`${adminCommentsEndpoint}/${id}`, {
      method: 'DELETE',
      headers: adminHeaders()
    });

    if (!response.ok) {
      setStatus('删除失败。');
      return;
    }

    await loadDashboard();
    setStatus('评论已删除。');
  };

  const renderComments = items => {
    clearNode(comments);
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-empty';
      empty.textContent = '暂无评论。';
      comments.append(empty);
      return;
    }

    items.forEach(comment => {
      const item = document.createElement('article');
      item.className = 'admin-comment';

      const meta = document.createElement('p');
      meta.className = 'admin-comment-meta';
      meta.textContent = `#${comment.id} · ${comment.name || '匿名'} · ${comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}`;

      const path = document.createElement('p');
      path.className = 'admin-comment-path';
      path.textContent = comment.articlePath || '';

      const email = document.createElement('p');
      email.className = 'admin-comment-email';
      email.textContent = comment.email || '未留邮箱';

      const body = document.createElement('p');
      body.className = 'admin-comment-body';
      body.textContent = comment.body || '';

      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = '删除';
      button.addEventListener('click', () => {
        deleteComment(comment.id).catch(() => {
          setStatus('删除失败。');
        });
      });

      item.append(meta, path, email, body, button);
      comments.append(item);
    });
  };

  const renderEchoUsage = usage => {
    clearNode(echoUsage);
    if (!echoUsage) return;

    const summary = usage?.summary || {};
    const total = document.createElement('p');
    total.textContent = `调用 ${summary.totalCount || 0} 次，成功 ${summary.successCount || 0} 次，失败 ${summary.failureCount || 0} 次。`;

    const tokens = document.createElement('p');
    tokens.textContent = `Token 估算：输入 ${summary.promptTokens || 0}，输出 ${summary.completionTokens || 0}。`;

    const list = document.createElement('ul');
    const recentEvents = Array.isArray(usage?.recentEvents) ? usage.recentEvents : [];
    recentEvents.slice(0, 5).forEach(event => {
      const item = document.createElement('li');
      const time = event.createdAt ? new Date(event.createdAt).toLocaleString() : '未知时间';
      item.textContent = `${time} · ${event.status || 'unknown'} · 输入 ${event.promptTokens || 0} · 输出 ${event.completionTokens || 0}`;
      list.append(item);
    });

    echoUsage.append(total, tokens, list);
  };

  const loadEchoAdmin = async () => {
    const [statusResponse, usageResponse] = await Promise.all([
      adminFetch(adminEchoStatusEndpoint, { cache: 'no-store' }),
      adminFetch(adminEchoUsageEndpoint, { cache: 'no-store' })
    ]);

    if (!statusResponse.ok || !usageResponse.ok) return;

    const statusBody = await statusResponse.json();
    const usageBody = await usageResponse.json();
    echoIsEnabled = statusBody.enabled !== false;
    if (echoEnabled) echoEnabled.textContent = echoIsEnabled ? '开启' : '暂停';
    if (echoToggleButton) echoToggleButton.textContent = echoIsEnabled ? '暂停 Echo' : '开启 Echo';
    renderEchoUsage(usageBody);
  };

  const toggleEchoEnabled = async () => {
    const response = await adminFetch(adminEchoStatusEndpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !echoIsEnabled })
    });

    if (!response.ok) {
      setStatus('Echo 状态更新失败。');
      return;
    }

    await loadEchoAdmin();
    setStatus(echoIsEnabled ? 'Echo 已开启。' : 'Echo 已暂停。');
  };

  async function loadDashboard() {
    setStatus('正在加载...');
    const [adminDataResponse, commentsResponse] = await Promise.all([
      fetch(buildAdminDataUrl(), { headers: adminHeaders(), cache: 'no-store' }),
      fetch(buildAdminCommentsUrl(), { headers: adminHeaders(), cache: 'no-store' })
    ]);

    if (!adminDataResponse.ok || !commentsResponse.ok) {
      content.hidden = true;
      loginForm.hidden = false;
      localStorage.removeItem(PASSWORD_STORAGE_KEY);
      setStatus('密码错误或后台暂时无法访问。');
      return;
    }

    const adminData = await adminDataResponse.json();
    const commentsData = await commentsResponse.json();
    onlineCount.textContent = String(adminData.onlineCount ?? '--');
    renderVisitorLogs(Array.isArray(adminData.visitorLogs) ? adminData.visitorLogs : []);
    renderVisitorPagination(adminData.visitorLogsPagination);
    renderComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
    renderCommentPagination(commentsData.commentsPagination);
    await loadEchoAdmin().catch(() => {
      if (echoUsage) echoUsage.textContent = 'Echo 状态暂时无法加载。';
    });
    content.hidden = false;
    loginForm.hidden = true;
    localStorage.setItem(PASSWORD_STORAGE_KEY, adminPassword);
    setStatus('');
  }

  const logout = () => {
    adminPassword = '';
    localStorage.removeItem(PASSWORD_STORAGE_KEY);
    content.hidden = true;
    loginForm.hidden = false;
    loginForm.reset();
    setStatus('');
  };

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    adminPassword = String(formData.get('password') || '');
    loadDashboard().catch(() => {
      content.hidden = true;
      setStatus('后台暂时无法访问。');
    });
  });

  if (refreshButton) {
    refreshButton.addEventListener('click', () => {
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (visitorFilters) {
    visitorFilters.addEventListener('submit', event => {
      event.preventDefault();
      readVisitorFilters();
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (visitorFilterResetButton) {
    visitorFilterResetButton.addEventListener('click', () => {
      resetVisitorFilters();
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (visitorPagePrevButton) {
    visitorPagePrevButton.addEventListener('click', () => {
      if (visitorFilterState.visitorPage <= 1) return;
      visitorFilterState.visitorPage -= 1;
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (visitorPageNextButton) {
    visitorPageNextButton.addEventListener('click', () => {
      visitorFilterState.visitorPage += 1;
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (commentFilters) {
    commentFilters.addEventListener('submit', event => {
      event.preventDefault();
      readCommentFilters();
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (commentFilterResetButton) {
    commentFilterResetButton.addEventListener('click', () => {
      resetCommentFilters();
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (commentPagePrevButton) {
    commentPagePrevButton.addEventListener('click', () => {
      if (commentFilterState.commentPage <= 1) return;
      commentFilterState.commentPage -= 1;
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (commentPageNextButton) {
    commentPageNextButton.addEventListener('click', () => {
      commentFilterState.commentPage += 1;
      loadDashboard().catch(() => {
        setStatus('后台暂时无法访问。');
      });
    });
  }

  if (logoutButton) {
    logoutButton.addEventListener('click', logout);
  }

  if (clearVisitsButton) {
    clearVisitsButton.addEventListener('click', () => {
      clearVisitorLogs().catch(() => {
        setStatus('清空最近访问失败。');
      });
    });
  }

  if (echoToggleButton) {
    echoToggleButton.addEventListener('click', () => {
      toggleEchoEnabled().catch(() => {
        setStatus('Echo 状态更新失败。');
      });
    });
  }

  const savedPassword = localStorage.getItem(PASSWORD_STORAGE_KEY);
  if (savedPassword) {
    adminPassword = savedPassword;
    loadDashboard().catch(() => {
      logout();
      setStatus('后台暂时无法访问。');
    });
  }
})();

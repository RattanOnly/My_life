(() => {
  const root = document.getElementById('admin-dashboard');
  if (!root || window.__adminDashboardInitialized) return;
  window.__adminDashboardInitialized = true;

  const loginForm = root.querySelector('[data-admin-login]');
  const status = root.querySelector('[data-admin-status]');
  const content = root.querySelector('[data-admin-content]');
  const onlineCount = root.querySelector('[data-admin-online-count]');
  const visitorLogs = root.querySelector('[data-admin-visitor-logs]');
  const comments = root.querySelector('[data-admin-comments]');
  const refreshButton = root.querySelector('[data-admin-refresh]');
  const logoutButton = root.querySelector('[data-admin-logout]');
  const clearVisitsButton = root.querySelector('[data-admin-clear-visits]');
  const adminDataEndpoint = root.dataset.adminDataEndpoint || '/admin-data';
  const adminCommentsEndpoint = root.dataset.adminCommentsEndpoint || '/admin-comments';
  const adminOwnerIpMarksEndpoint = root.dataset.adminOwnerIpMarksEndpoint || '/admin-owner-ip-marks';
  const adminClearVisitsEndpoint = root.dataset.adminClearVisitsEndpoint || '/admin-visits';
  const PASSWORD_STORAGE_KEY = 'admin_dashboard_password';

  let adminPassword = '';

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

  const adminFetch = async (url, options = {}) => fetch(url, {
    ...options,
    headers: {
      ...adminHeaders(),
      ...options.headers
    }
  });

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
    logs.forEach(log => {
      const row = document.createElement('tr');
      appendCell(row, log.visitedAt ? new Date(log.visitedAt).toLocaleString() : '');
      appendCell(row, log.isOwnerVisitor ? '本机' : log.ipAddress);
      appendCell(row, log.visitorLocation || '未知地区');
      appendCell(row, log.visitedPage);
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

  async function loadDashboard() {
    setStatus('正在加载...');
    const [adminDataResponse, commentsResponse] = await Promise.all([
      fetch(adminDataEndpoint, { headers: adminHeaders(), cache: 'no-store' }),
      fetch(adminCommentsEndpoint, { headers: adminHeaders(), cache: 'no-store' })
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
    renderComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
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

  const savedPassword = localStorage.getItem(PASSWORD_STORAGE_KEY);
  if (savedPassword) {
    adminPassword = savedPassword;
    loadDashboard().catch(() => {
      logout();
      setStatus('后台暂时无法访问。');
    });
  }
})();

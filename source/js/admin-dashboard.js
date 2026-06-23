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
  const adminDataEndpoint = root.dataset.adminDataEndpoint || '/admin-data';
  const adminCommentsEndpoint = root.dataset.adminCommentsEndpoint || '/admin-comments';

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

  const renderVisitorLogs = logs => {
    clearNode(visitorLogs);
    logs.forEach(log => {
      const row = document.createElement('tr');
      appendCell(row, log.visitedAt ? new Date(log.visitedAt).toLocaleString() : '');
      appendCell(row, log.ipAddress);
      appendCell(row, log.visitedPage);
      appendCell(row, log.visitorDeviceSummary);
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
      setStatus('密码错误或后台暂时无法访问。');
      return;
    }

    const adminData = await adminDataResponse.json();
    const commentsData = await commentsResponse.json();
    onlineCount.textContent = String(adminData.onlineCount ?? '--');
    renderVisitorLogs(Array.isArray(adminData.visitorLogs) ? adminData.visitorLogs : []);
    renderComments(Array.isArray(commentsData.comments) ? commentsData.comments : []);
    content.hidden = false;
    setStatus('');
  }

  loginForm.addEventListener('submit', event => {
    event.preventDefault();
    const formData = new FormData(loginForm);
    adminPassword = String(formData.get('password') || '');
    loadDashboard().catch(() => {
      content.hidden = true;
      setStatus('后台暂时无法访问。');
    });
  });
})();

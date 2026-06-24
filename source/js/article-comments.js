(() => {
  const createCommentNode = comment => {
    const item = document.createElement('article');
    item.className = 'article-comment';

    const meta = document.createElement('div');
    meta.className = 'article-comment-meta';

    const name = document.createElement('strong');
    name.textContent = comment.name || '匿名';

    const time = document.createElement('time');
    time.dateTime = comment.createdAt || '';
    time.textContent = comment.createdAt
      ? new Date(comment.createdAt).toLocaleString()
      : '';

    const body = document.createElement('p');
    body.textContent = comment.body || '';

    meta.append(name, time);
    item.append(meta, body);
    return item;
  };

  const initArticleComments = () => {
    const root = document.getElementById('article-comments');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const endpoint = root.dataset.endpoint || '/comments';
    const list = root.querySelector('[data-comments-list]');
    const form = root.querySelector('[data-comments-form]');
    const status = root.querySelector('[data-comments-status]');
    const articlePath = window.location.pathname;
    const pathAliases = (() => {
      try {
        const aliases = JSON.parse(root.getAttribute('data-comment-path-aliases') || '[]');
        return Array.isArray(aliases) ? aliases.filter(alias => typeof alias === 'string' && alias) : [];
      } catch {
        return [];
      }
    })();
    const commentsUrl = `${endpoint}?path=${encodeURIComponent(articlePath)}&aliases=${encodeURIComponent(pathAliases.join(','))}`;

    const setStatus = message => {
      if (status) status.textContent = message;
    };

    const markUnavailable = () => {
      root.dataset.status = 'unavailable';
      setStatus('评论暂时无法加载。');
    };

    const renderComments = comments => {
      if (!list) return;
      list.textContent = '';

      if (!comments.length) {
        const empty = document.createElement('p');
        empty.className = 'article-comments-empty';
        empty.textContent = '还没有评论。';
        list.append(empty);
        return;
      }

      comments.forEach(comment => {
        list.append(createCommentNode(comment));
      });
    };

    const loadComments = async () => {
      const response = await fetch(commentsUrl, {
        credentials: 'omit',
        cache: 'no-store'
      });
      if (!response.ok) {
        markUnavailable();
        return;
      }

      const body = await response.json();
      renderComments(Array.isArray(body.comments) ? body.comments : []);
      root.dataset.status = 'ready';
      setStatus('');
    };

    const submitComment = async event => {
      event.preventDefault();
      if (!form) return;

      const formData = new FormData(form);
      const payload = {
        path: articlePath,
        name: String(formData.get('name') || ''),
        body: String(formData.get('body') || '')
      };

      setStatus('正在提交...');
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        setStatus(errorBody.error || '评论提交失败。');
        root.dataset.status = 'unavailable';
        return;
      }

      const responseBody = await response.json();
      if (responseBody.comment && list) {
        const empty = list.querySelector('.article-comments-empty');
        if (empty) empty.remove();
        list.append(createCommentNode(responseBody.comment));
      }

      form.reset();
      root.dataset.status = 'ready';
      setStatus('谢谢你光顾我的人生！');
    };

    loadComments().catch(() => {
      markUnavailable();
    });

    if (form) {
      form.addEventListener('submit', event => {
        submitComment(event).catch(() => {
          root.dataset.status = 'unavailable';
          setStatus('评论提交失败。');
        });
      });
    }
  };

  initArticleComments();

  if (!window.__articleCommentsPjaxBound) {
    window.__articleCommentsPjaxBound = true;
    window.addEventListener('pjax:success', initArticleComments);
  }
})();

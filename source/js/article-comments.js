(() => {
  const DELETE_TOKENS_STORAGE_KEY = 'article_comment_delete_tokens';

  const readDeleteTokens = () => {
    try {
      const storedTokens = JSON.parse(window.localStorage.getItem(DELETE_TOKENS_STORAGE_KEY) || '{}');
      return storedTokens && typeof storedTokens === 'object' ? storedTokens : {};
    } catch {
      return {};
    }
  };

  const writeDeleteTokens = tokens => {
    try {
      window.localStorage.setItem(DELETE_TOKENS_STORAGE_KEY, JSON.stringify(tokens));
    } catch {
      // Ignore storage failures; comments still work without visitor-side deletion.
    }
  };

  const createCommentNode = (comment, actions, isReply = false) => {
    const item = document.createElement('article');
    item.className = isReply ? 'article-comment article-comment-reply' : 'article-comment';
    item.setAttribute('data-comment-id', String(comment.id || ''));
    if (isReply) item.setAttribute('data-comment-reply', 'true');
    if (comment.isDeleted) item.classList.add('article-comment-deleted');

    const meta = document.createElement('div');
    meta.className = 'article-comment-meta';

    const name = document.createElement('strong');
    name.textContent = comment.name || (comment.isDeleted ? '评论已删除' : '匿名');

    const time = document.createElement('time');
    time.dateTime = comment.createdAt || '';
    time.textContent = comment.createdAt
      ? new Date(comment.createdAt).toLocaleString()
      : '';

    const body = document.createElement('p');
    body.textContent = comment.body || (comment.isDeleted ? '评论已删除' : '');

    const actionRow = document.createElement('div');
    actionRow.className = 'article-comment-actions';

    if (!comment.isDeleted) {
      const replyButton = document.createElement('button');
      replyButton.type = 'button';
      replyButton.className = 'article-comment-reply-button';
      replyButton.textContent = '回复';
      replyButton.addEventListener('click', () => {
        actions.onReply(comment);
      });
      actionRow.append(replyButton);
    }

    if (!comment.isDeleted && actions.canDelete(comment)) {
      const deleteButton = document.createElement('button');
      deleteButton.type = 'button';
      deleteButton.className = 'article-comment-delete-button';
      deleteButton.textContent = '删除';
      deleteButton.addEventListener('click', () => {
        actions.onDelete(comment);
      });
      actionRow.append(deleteButton);
    }

    meta.append(name, time);
    item.append(meta, body);
    if (actionRow.childNodes.length) item.append(actionRow);
    return item;
  };

  const groupComments = comments => {
    const commentsById = new Map();
    comments.forEach(comment => {
      commentsById.set(Number(comment.id), comment);
    });

    const topLevelComments = [];
    const repliesByParentId = new Map();

    comments.forEach(comment => {
      const parentId = Number(comment.parentId || 0);
      if (!parentId || !commentsById.has(parentId)) {
        topLevelComments.push(comment);
        return;
      }

      const replies = repliesByParentId.get(parentId) || [];
      replies.push(comment);
      repliesByParentId.set(parentId, replies);
    });

    return { topLevelComments, repliesByParentId };
  };

  const initArticleComments = () => {
    const root = document.getElementById('article-comments');
    if (!root || root.dataset.initialized === 'true') return;
    root.dataset.initialized = 'true';

    const endpoint = root.dataset.endpoint || '/comments';
    const commentEndpoint = endpoint.replace(/\/$/, '');
    const list = root.querySelector('[data-comments-list]');
    const form = root.querySelector('[data-comments-form]');
    const status = root.querySelector('[data-comments-status]');
    const bodyField = form ? form.querySelector('[name="body"]') : null;
    const articlePath = window.location.pathname;
    let replyParentId = null;
    let replyParentName = '';
    let deleteTokens = readDeleteTokens();
    const pathAliases = (() => {
      try {
        const aliases = JSON.parse(root.getAttribute('data-comment-path-aliases') || '[]');
        return Array.isArray(aliases) ? aliases.filter(alias => typeof alias === 'string' && alias) : [];
      } catch {
        return [];
      }
    })();
    const commentsUrl = `${commentEndpoint}?path=${encodeURIComponent(articlePath)}&aliases=${encodeURIComponent(pathAliases.join(','))}`;

    const replyStatus = document.createElement('p');
    replyStatus.className = 'article-comments-replying';
    replyStatus.hidden = true;

    const replyStatusText = document.createElement('span');
    const cancelReplyButton = document.createElement('button');
    cancelReplyButton.type = 'button';
    cancelReplyButton.textContent = '取消回复';
    replyStatus.append(replyStatusText, cancelReplyButton);
    if (form) form.prepend(replyStatus);

    const setStatus = message => {
      if (status) status.textContent = message;
    };

    const updateReplyStatus = () => {
      if (!replyParentId) {
        replyStatus.hidden = true;
        replyStatusText.textContent = '';
        return;
      }

      replyStatus.hidden = false;
      replyStatusText.textContent = `正在回复 ${replyParentName || '这条评论'}`;
    };

    const clearReplyTarget = () => {
      replyParentId = null;
      replyParentName = '';
      updateReplyStatus();
    };

    const setReplyTarget = comment => {
      replyParentId = Number(comment.id || 0) || null;
      replyParentName = comment.name || '匿名';
      updateReplyStatus();
      if (bodyField) bodyField.focus();
    };

    cancelReplyButton.addEventListener('click', clearReplyTarget);

    const deleteTokenKey = comment => String(comment.id || '');

    const getActiveDeleteToken = comment => {
      const key = deleteTokenKey(comment);
      const token = deleteTokens[key];
      if (!token || !token.deleteToken || !token.canDeleteUntil) return null;

      const canDeleteUntil = Date.parse(token.canDeleteUntil);
      if (Number.isNaN(canDeleteUntil) || canDeleteUntil <= Date.now()) {
        delete deleteTokens[key];
        writeDeleteTokens(deleteTokens);
        return null;
      }

      return token;
    };

    const storeDeleteToken = comment => {
      if (!comment || !comment.id || !comment.deleteToken || !comment.canDeleteUntil) return;

      deleteTokens[String(comment.id)] = {
        deleteToken: comment.deleteToken,
        canDeleteUntil: comment.canDeleteUntil
      };
      writeDeleteTokens(deleteTokens);
    };

    const removeDeleteToken = comment => {
      delete deleteTokens[deleteTokenKey(comment)];
      writeDeleteTokens(deleteTokens);
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

      const { topLevelComments, repliesByParentId } = groupComments(comments);
      const actions = {
        onReply: setReplyTarget,
        onDelete: deleteComment,
        canDelete: comment => Boolean(getActiveDeleteToken(comment))
      };

      topLevelComments.forEach(comment => {
        const item = createCommentNode(comment, actions);
        const replies = repliesByParentId.get(Number(comment.id)) || [];
        if (replies.length) {
          const repliesNode = document.createElement('div');
          repliesNode.className = 'article-comment-replies';
          replies.forEach(reply => {
            repliesNode.append(createCommentNode(reply, actions, true));
          });
          item.append(repliesNode);
        }
        list.append(item);
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

    const deleteComment = async comment => {
      const token = getActiveDeleteToken(comment);
      if (!token) {
        setStatus('这条评论已经不能删除。');
        return;
      }

      if (!window.confirm('确认删除这条评论吗？')) return;

      setStatus('正在删除...');
      const response = await fetch(`${commentEndpoint}/${encodeURIComponent(comment.id)}`, {
        method: 'DELETE',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ deleteToken: token.deleteToken })
      });

      if (!response.ok) {
        if (response.status === 403 || response.status === 410) {
          removeDeleteToken(comment);
        }
        setStatus('删除失败，可能已超过可删除时间。');
        return;
      }

      removeDeleteToken(comment);
      await loadComments();
      setStatus('评论已删除。');
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
      if (replyParentId) payload.parentId = replyParentId;

      setStatus('正在提交...');
      const response = await fetch(commentEndpoint, {
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
      storeDeleteToken(responseBody.comment);
      form.reset();
      clearReplyTarget();
      await loadComments();
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

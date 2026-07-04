(() => {
  const root = document.getElementById('echo-page');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const form = root.querySelector('[data-echo-form]');
  const messages = root.querySelector('[data-echo-messages]');
  const status = root.querySelector('[data-echo-status]');
  const messageField = form ? form.querySelector('[name="message"]') : null;
  const submitButton = form ? form.querySelector('button[type="submit"]') : null;
  const chatEndpoint = root.dataset.echoChatEndpoint || '/echo-chat';
  const statusEndpoint = root.dataset.echoStatusEndpoint || '/echo-status';
  const disabledMessage = '这阵回声暂时坐下来休息了。晚一点再来找他吧。';
  const history = [];

  const setStage = stage => {
    root.dataset.echoStage = stage;
  };

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  const setDisabled = disabled => {
    if (messageField) messageField.disabled = disabled;
    if (submitButton) submitButton.disabled = disabled;
  };

  const appendMessage = (role, text) => {
    if (!messages) return;
    const item = document.createElement('article');
    item.className = `echo-message echo-message-${role}`;
    item.textContent = text;
    messages.append(item);
  };

  const rememberMessage = (role, content) => {
    history.push({ role, content });
    while (history.length > 8) history.shift();
  };

  const loadStatus = async () => {
    const response = await fetch(statusEndpoint, {
      credentials: 'omit',
      cache: 'no-store'
    });
    if (!response.ok) return;

    const body = await response.json();
    if (body.enabled === false) {
      setDisabled(true);
      setStage('disabled');
      setStatus(disabledMessage);
    }
  };

  const submitMessage = async event => {
    event.preventDefault();
    if (!messageField) return;

    const text = messageField.value.trim();
    if (!text) return;

    const previousHistory = history.slice(-6);
    appendMessage('user', text);
    rememberMessage('user', text);
    messageField.value = '';
    setDisabled(true);
    setStage('thinking');
    setStatus('Echo 正在想一想。');

    const response = await fetch(chatEndpoint, {
      method: 'POST',
      credentials: 'omit',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        message: text,
        history: previousHistory
      })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const isDisabled = response.status === 503;
      setStage(isDisabled ? 'disabled' : 'idle_sit');
      setStatus(body.message || (isDisabled ? disabledMessage : '这阵回声刚刚有点走神。可以再试一次。'));
      setDisabled(isDisabled);
      return;
    }

    appendMessage('assistant', body.reply || '');
    rememberMessage('assistant', body.reply || '');
    setStage('reply_ready');
    setStatus('');
    setDisabled(false);
    if (messageField) messageField.focus();
  };

  if (messageField) {
    messageField.addEventListener('input', () => {
      setStage(messageField.value.trim() ? 'walk' : 'idle_sit');
    });
  }

  if (form) {
    form.addEventListener('submit', event => {
      submitMessage(event).catch(() => {
        setStage('idle_sit');
        setDisabled(false);
        setStatus('这阵回声刚刚有点走神。可以再试一次。');
      });
    });
  }

  loadStatus().catch(() => {
    setStatus('');
  });
})();

(() => {
  const initEchoChat = () => {
  const root = document.getElementById('echo-page');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const form = root.querySelector('[data-echo-form]');
  const messages = root.querySelector('[data-echo-messages]');
  const status = root.querySelector('[data-echo-status]');
  const messageField = form ? form.querySelector('[name="message"]') : null;
  const submitButton = form ? form.querySelector('[data-echo-submit]') : null;
  const resolveEndpoint = (endpoint, fallback) => {
    const selectedEndpoint = endpoint || fallback;
    const pageLocation = typeof location === 'object' ? location : null;
    const localHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const shouldUseLocalWorker =
      pageLocation &&
      localHosts.has(pageLocation.hostname) &&
      pageLocation.port === '4000' &&
      selectedEndpoint.startsWith('/');

    return shouldUseLocalWorker ? `http://localhost:8787${selectedEndpoint}` : selectedEndpoint;
  };
  const chatEndpoint = resolveEndpoint(root.dataset.echoChatEndpoint, '/echo-chat');
  const statusEndpoint = resolveEndpoint(root.dataset.echoStatusEndpoint, '/echo-status');
  const disabledMessage = '这阵回声暂时坐下来休息了。晚一点再来找他吧。';
  const history = [];
  let characterStage = null;
  const createNoopCharacter = () => ({
    ready: Promise.resolve(false),
    playEntrance() {},
    setState() {},
    destroy() {}
  });
  const isCharacterAdapter = adapter =>
    adapter &&
    typeof adapter.playEntrance === 'function' &&
    typeof adapter.setState === 'function' &&
    typeof adapter.destroy === 'function';
  const createCharacterAdapter = () => {
    if (!globalThis.EchoCharacter || typeof globalThis.EchoCharacter.create !== 'function') {
      return createNoopCharacter();
    }

    try {
      const adapter = globalThis.EchoCharacter.create(root);
      return isCharacterAdapter(adapter) ? adapter : createNoopCharacter();
    } catch (error) {
      return createNoopCharacter();
    }
  };
  const callCharacter = (adapter, method, ...args) => {
    try {
      const action = adapter && adapter[method];
      if (typeof action !== 'function') return undefined;
      const result = action.apply(adapter, args);
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return result;
    } catch (error) {
      return undefined;
    }
  };
  const character = createCharacterAdapter();

  const setStage = stage => {
    root.dataset.echoStage = stage;
    if (characterStage === stage) return;
    characterStage = stage;
    callCharacter(character, 'setState', stage);
  };

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  const setDisabled = disabled => {
    if (messageField) messageField.disabled = disabled;
    if (submitButton) submitButton.disabled = disabled;
  };

  const appendMessage = (role, text, modifier) => {
    if (!messages) return null;
    const item = document.createElement('article');
    item.className = modifier
      ? `echo-message echo-message-${role} echo-message-${modifier}`
      : `echo-message echo-message-${role}`;
    item.textContent = text;
    messages.append(item);
    return item;
  };

  const removeMessage = item => {
    if (item && typeof item.remove === 'function') item.remove();
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
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    if (!messageField) return;

    const text = messageField.value.trim();
    if (!text) return;

    const previousHistory = history.slice(-6);
    appendMessage('user', text);
    rememberMessage('user', text);
    messageField.value = '';
    setDisabled(true);
    setStage('thinking');
    setStatus('');
    const thinkingMessage = appendMessage('assistant', '我在想一想...', 'thinking');

    let response;
    try {
      response = await fetch(chatEndpoint, {
        method: 'POST',
        credentials: 'omit',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: previousHistory
        })
      });
    } catch (error) {
      removeMessage(thinkingMessage);
      throw error;
    }

    const body = await response.json().catch(() => ({}));
    removeMessage(thinkingMessage);
    if (!response.ok) {
      const isDisabled = response.status === 503;
      setStage(isDisabled ? 'disabled' : 'idle');
      setStatus(body.message || (isDisabled ? disabledMessage : '这阵回声刚刚有点走神。可以再试一次。'));
      setDisabled(isDisabled);
      return;
    }

    appendMessage('assistant', body.reply || '');
    rememberMessage('assistant', body.reply || '');
    setStatus('');
    setStage('reply_ready');
    setDisabled(false);
    if (messageField) messageField.focus();
  };

  if (messageField) {
    const syncInputStage = () => {
      if (messageField.value.trim()) {
        setStage('listening');
        return;
      }

      if (root.dataset.echoStage !== 'reply_ready') setStage('idle');
    };

    messageField.addEventListener('input', syncInputStage);
    messageField.addEventListener('focus', syncInputStage);
    messageField.addEventListener('blur', () => {
      if (!messageField.value.trim()) setStage('idle');
    });
  }

  if (form) {
    const handleSubmit = event => {
      submitMessage(event).catch(() => {
        setStage('idle');
        setDisabled(false);
        setStatus('这阵回声刚刚有点走神。可以再试一次。');
      });
    };

    form.addEventListener('submit', handleSubmit);
    if (submitButton) submitButton.addEventListener('click', handleSubmit);
  }

  callCharacter(character, 'playEntrance');
  setStage('idle');

  loadStatus().catch(() => {
    setStatus('');
  });
  };

  initEchoChat();
  if (globalThis.addEventListener) globalThis.addEventListener('pjax:success', initEchoChat);
})();

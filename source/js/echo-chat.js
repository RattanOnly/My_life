(() => {
  const root = document.getElementById('echo-page');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const form = root.querySelector('[data-echo-form]');
  const messages = root.querySelector('[data-echo-messages]');
  const status = root.querySelector('[data-echo-status]');
  const messageField = form ? form.querySelector('[name="message"]') : null;

  const setStage = stage => {
    root.dataset.echoStage = stage;
  };

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  const appendMessage = (role, text) => {
    if (!messages) return;
    const item = document.createElement('article');
    item.className = `echo-message echo-message-${role}`;
    item.textContent = text;
    messages.append(item);
  };

  if (messageField) {
    messageField.addEventListener('input', () => {
      setStage(messageField.value.trim() ? 'walk' : 'idle_sit');
    });
  }

  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      const text = messageField ? messageField.value.trim() : '';
      if (!text) return;
      appendMessage('user', text);
      if (messageField) messageField.value = '';
      setStage('thinking');
      setStatus('Echo 正在想一想。');
    });
  }
})();

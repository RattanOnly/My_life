(() => {
  const root = document.getElementById('echo-page');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  const form = root.querySelector('[data-echo-form]');
  const status = root.querySelector('[data-echo-status]');
  const messageField = form ? form.querySelector('[name="message"]') : null;
  const unavailableMessage = 'Echo 还在准备中，等后端接好后就可以说话。';

  const setStage = stage => {
    root.dataset.echoStage = stage;
  };

  const setStatus = message => {
    if (status) status.textContent = message;
  };

  if (messageField) {
    messageField.addEventListener('input', () => {
      setStage(messageField.value.trim() ? 'walk' : 'idle_sit');
    });
  }

  if (form) {
    form.addEventListener('submit', event => {
      event.preventDefault();
      setStage(messageField && messageField.value.trim() ? 'walk' : 'idle_sit');
      setStatus(unavailableMessage);
    });
  }

  setStatus(unavailableMessage);
})();

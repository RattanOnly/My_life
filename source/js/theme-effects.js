(() => {
  // Register all visual effect themes here to keep switching loosely coupled.
  const DEFAULT_EFFECT_ID = 'snow';
  const PERSIST_KEY = 'site_effect_active';

  const effectThemes = [
    {
      id: 'snow',
      name: 'Snowfall',
      mount({ target = document.body } = {}) {
        const root = document.createElement('div');
        root.className = 'site-effect site-effect--snow';
        root.dataset.effectTheme = 'snow';

        const snowLayer = document.createElement('div');
        snowLayer.className = 'initial-snow';

        const snowSymbols = ['❅', '❆', '✻'];
        const snowCount = 50;
        for (let i = 0; i < snowCount; i += 1) {
          const flake = document.createElement('div');
          flake.className = 'snow';
          flake.textContent = snowSymbols[i % snowSymbols.length];
          snowLayer.appendChild(flake);
        }

        root.appendChild(snowLayer);
        (target || document.body).appendChild(root);

        return () => {
          root.remove();
        };
      },
    },
  ];

  const state = {
    cleanup: null,
    activeId: null,
  };

  const persistActive = effectId => {
    try {
      localStorage.setItem(PERSIST_KEY, effectId);
    } catch (error) {
      // Access to storage might be blocked; ignore.
    }
  };

  const readPersisted = () => {
    try {
      return localStorage.getItem(PERSIST_KEY) || DEFAULT_EFFECT_ID;
    } catch (error) {
      return DEFAULT_EFFECT_ID;
    }
  };

  const activate = effectId => {
    if (!effectId) return false;
    if (state.activeId === effectId) return true;

    const theme = effectThemes.find(item => item.id === effectId);
    if (!theme) return false;

    if (state.cleanup) {
      state.cleanup();
      state.cleanup = null;
    }

    const cleanup = theme.mount();
    state.cleanup = typeof cleanup === 'function' ? cleanup : null;
    state.activeId = effectId;
    persistActive(effectId);
    return true;
  };

  const bootstrap = () => {
    const preferred = readPersisted();
    if (!activate(preferred) && preferred !== DEFAULT_EFFECT_ID) {
      activate(DEFAULT_EFFECT_ID);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }

  window.__SITE_EFFECTS__ = {
    list: effectThemes.map(({ id, name }) => ({ id, name })),
    activate,
    get active() {
      return state.activeId;
    },
  };
})();

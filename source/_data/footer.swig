<audio id="site-bgm" src="/music/bgm.mp3" preload="auto" loop style="position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;"></audio>
<script>
(() => {
  const themeEl = document.getElementById('site-bgm');
  if (!themeEl || window.__siteBgmInitialized) return;
  window.__siteBgmInitialized = true;

  const STORAGE_KEY = 'site_bgm_time';
  const UNLOCK_KEY = 'site_bgm_unlocked';

  const clampVolume = value => {
    const vol = Number(value);
    if (!Number.isFinite(vol)) return 1;
    return Math.min(1, Math.max(0, vol));
  };

  const restoreThemeTime = () => {
    const resumeTime = parseFloat(sessionStorage.getItem(STORAGE_KEY));
    if (!Number.isNaN(resumeTime)) {
      themeEl.currentTime = resumeTime;
    }
  };

  const saveThemeTime = () => sessionStorage.setItem(STORAGE_KEY, themeEl.currentTime.toString());
  ['visibilitychange', 'pagehide', 'beforeunload'].forEach(eventName => {
    window.addEventListener(eventName, () => {
      if (eventName === 'visibilitychange' && !document.hidden) return;
      saveThemeTime();
    }, { passive: true });
  });

  const createTrack = ({ element, url, loop = true, volume = 1 }) => {
    const el = element || new Audio();
    el.preload = 'auto';
    if (url) el.src = url;
    el.loop = loop;
    el.volume = clampVolume(volume);

    const load = newUrl => {
      if (newUrl) el.src = newUrl;
      if (el.readyState >= 2) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const handleCanPlay = () => {
          cleanup();
          resolve();
        };
        const handleError = () => {
          cleanup();
          reject(new Error('音频加载失败'));
        };
        const cleanup = () => {
          el.removeEventListener('canplaythrough', handleCanPlay);
          el.removeEventListener('error', handleError);
        };
        el.addEventListener('canplaythrough', handleCanPlay, { once: true });
        el.addEventListener('error', handleError, { once: true });
      });
    };

    const play = opts => {
      if (opts) {
        if (typeof opts.loop !== 'undefined') el.loop = !!opts.loop;
        if (typeof opts.volume !== 'undefined') el.volume = clampVolume(opts.volume);
      }
      return el.play();
    };

    const pause = () => el.pause();
    const stop = () => {
      pause();
      el.currentTime = 0;
    };
    const destroy = () => {
      stop();
      if (!element) {
        el.src = '';
      }
    };
    const isPlaying = () => !el.paused && !el.ended;

    return { el, load, play, pause, stop, destroy, isPlaying };
  };

  const createPlaylistTrack = ({ list = [], volume = 1, loopList = true } = {}) => {
    const el = new Audio();
    el.preload = 'auto';
    el.volume = clampVolume(volume);

    let items = Array.isArray(list) ? list.slice() : [];
    let idx = 0;
    let looping = !!loopList;

    const hasItems = () => Array.isArray(items) && items.length > 0;
    const setSource = () => {
      if (!hasItems()) return;
      const current = items[idx];
      if (current && current.url) {
        el.src = current.url;
      }
      el.loop = false;
    };

    const load = (newList = [], options = {}) => {
      items = Array.isArray(newList) ? newList.slice() : [];
      idx = 0;
      if (typeof options.volume !== 'undefined') {
        el.volume = clampVolume(options.volume);
      }
      if (typeof options.loopList !== 'undefined') {
        looping = !!options.loopList;
      }
      setSource();
    };

    const play = async options => {
      if (options) {
        if (typeof options.volume !== 'undefined') {
          el.volume = clampVolume(options.volume);
        }
        if (typeof options.loopList !== 'undefined') {
          looping = !!options.loopList;
        }
      }
      if (!hasItems()) return false;
      if (!el.src) {
        setSource();
      }
      try {
        await el.play();
        return true;
      } catch (error) {
        return false;
      }
    };

    const pause = () => el.pause();
    const stop = () => {
      pause();
      el.currentTime = 0;
    };
    const destroy = () => {
      el.removeEventListener('ended', handleEnded);
      stop();
      el.src = '';
      items = [];
    };
    const isPlaying = () => !el.paused && !el.ended;

    const handleEnded = () => {
      if (!hasItems()) return;
      if (!looping && idx >= items.length - 1) {
        stop();
        return;
      }
      idx = (idx + 1) % items.length;
      setSource();
      play();
    };
    el.addEventListener('ended', handleEnded);

    load(items, { volume, loopList });
    return { el, load, play, pause, stop, destroy, isPlaying };
  };

  const readArticleConfig = () => {
    const holder = document.getElementById('article-bgm-config');
    const raw = holder ? holder.textContent.trim() : '';
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch (error) {
        console.warn('文章BGM配置解析失败', error);
        try {
          // eslint-disable-next-line no-new-func
          return new Function(`return (${raw});`)();
        } catch (fallbackError) {
          console.warn('文章BGM配置回退解析失败', fallbackError);
        }
      }
    }
    return typeof window.__ARTICLE_BGM !== 'undefined' && window.__ARTICLE_BGM !== null
      ? window.__ARTICLE_BGM
      : null;
  };

  const normalizeArticleConfig = raw => {
    if (!raw) return null;
    const normalizeItem = item => {
      const normalizeUrl = url => {
        if (!url || typeof url !== 'string') return null;
        const trimmed = url.trim();
        if (!trimmed) return null;
        if (/^(https?:)?\/\//i.test(trimmed)) return trimmed; // absolute or protocol-relative
        if (trimmed.startsWith('/')) return trimmed; // site-root path
        return `/${trimmed.replace(/^\/+/, '')}`; // treat as root-relative
      };

      if (!item) return null;
      if (typeof item === 'string') {
        const url = normalizeUrl(item);
        return url ? { url } : null;
      }
      if (item.url) {
        const url = normalizeUrl(item.url);
        return url ? { url } : null;
      }
      return null;
    };

    const buildList = value => {
      const list = Array.isArray(value) ? value : [value];
      const normalized = list.map(normalizeItem).filter(Boolean);
      return normalized.length ? normalized : null;
    };

    const baseVolume = typeof raw.volume === 'undefined' ? 1 : clampVolume(raw.volume);
    const baseLoopList = typeof raw.loopList === 'undefined' ? true : !!raw.loopList;
    let list = null;

    if (Array.isArray(raw)) {
      list = buildList(raw);
    } else if (typeof raw === 'string') {
      list = buildList(raw);
    } else if (raw.list) {
      list = buildList(raw.list);
    } else if (raw.url) {
      list = buildList(raw);
    }

    if (!list) return null;
    return {
      id: raw.id || location.pathname,
      list,
      volume: baseVolume,
      loopList: baseLoopList
    };
  };

  const themeTrack = createTrack({ element: themeEl, loop: themeEl.loop, volume: themeEl.volume || 1 });
  restoreThemeTime();

  class BgmManager {
    constructor(track) {
      this.themeTrack = track;
      this.articleTrack = null;
      this.articleConfig = null;
      this.activeArticleId = null;
      this.lastConfigKey = null;
      this.userUnlocked = sessionStorage.getItem(UNLOCK_KEY) === '1' || !track.el.paused;
      this.applyQueued = false;
      this.attachGestureTriggers();
      this.applyPageConfig();
      this.bindPjax();
      this.registerThemeHooks();
    }

    attachGestureTriggers(force = false) {
      if (this.userUnlocked && !force) return;
      this.detachGestureTriggers();
      this.handleClick = () => this.handleGesture();
      this.handleTouch = () => this.handleGesture();
      document.addEventListener('click', this.handleClick, { once: true });
      document.addEventListener('touchstart', this.handleTouch, { once: true, passive: true });
    }

    detachGestureTriggers() {
      if (this.handleClick) {
        document.removeEventListener('click', this.handleClick);
        this.handleClick = null;
      }
      if (this.handleTouch) {
        document.removeEventListener('touchstart', this.handleTouch);
        this.handleTouch = null;
      }
    }

    async handleGesture() {
      this.detachGestureTriggers();
      const ok = await this.applyIntent();
      this.userUnlocked = ok;
      if (!ok) this.attachGestureTriggers();
    }

    async applyIntent() {
      if (this.articleConfig) {
        const ok = await this.playArticle();
        if (ok) return true;
      }
      return this.playTheme();
    }

    async playTheme(options = {}) {
      const { restart = false } = options;
      this.activeArticleId = null;
      if (this.articleTrack) {
        this.articleTrack.destroy();
        this.articleTrack = null;
      }
      if (restart) {
        this.themeTrack.stop();
      }
      if (this.themeTrack.isPlaying()) {
        this.userUnlocked = true;
        sessionStorage.setItem(UNLOCK_KEY, '1');
        return true;
      }
      try {
        await this.themeTrack.play();
        this.userUnlocked = true;
        sessionStorage.setItem(UNLOCK_KEY, '1');
        return true;
      } catch (error) {
        this.userUnlocked = false;
        return false;
      }
    }

    async playArticle() {
      const cfg = this.articleConfig;
      if (!cfg || !cfg.list || !cfg.list.length) return this.playTheme();

      if (!this.articleTrack) {
        this.articleTrack = createPlaylistTrack({ list: cfg.list, volume: cfg.volume, loopList: cfg.loopList });
      } else {
        this.articleTrack.load(cfg.list, { volume: cfg.volume, loopList: cfg.loopList });
      }
      this.activeArticleId = cfg.id;
      saveThemeTime();
      this.themeTrack.pause();

      try {
        const ok = await this.articleTrack.play({ loopList: cfg.loopList, volume: cfg.volume });
        if (!ok) throw new Error('文章BGM播放失败');
        this.userUnlocked = true;
        sessionStorage.setItem(UNLOCK_KEY, '1');
        return true;
      } catch (error) {
        console.warn('文章BGM播放失败', error);
        this.userUnlocked = false;
        this.stopArticle({ resumeTheme: true, clearConfig: false });
        this.attachGestureTriggers(true);
        return false;
      }
    }

    stopArticle(options = { resumeTheme: true, clearConfig: true }) {
      const { resumeTheme = true, clearConfig = true } = options;
      if (this.articleTrack) {
        this.articleTrack.destroy();
        this.articleTrack = null;
      }
      this.activeArticleId = null;
      if (clearConfig) {
        this.articleConfig = null;
        this.lastConfigKey = null;
      }
      if (resumeTheme) {
        this.playTheme({ restart: true });
      }
    }

    async applyPageConfig() {
      const cfg = normalizeArticleConfig(readArticleConfig());
      const cfgKey = cfg ? JSON.stringify(cfg) : 'null';
      if (cfgKey === this.lastConfigKey && cfg && this.articleTrack && this.activeArticleId === cfg.id) {
        return;
      }
      this.articleConfig = cfg;
      this.lastConfigKey = cfgKey;
      if (!this.userUnlocked) {
        this.attachGestureTriggers();
        return;
      }
      const ok = await this.applyIntent();
      if (!ok) {
        this.attachGestureTriggers(true);
      } else {
        this.detachGestureTriggers();
      }
    }

    queueApplyPageConfig() {
      if (this.applyQueued) return;
      this.applyQueued = true;
      Promise.resolve().then(() => {
        this.applyQueued = false;
        this.applyPageConfig();
      });
    }

    observeArticleConfig() {
      if (this.articleObserver || typeof MutationObserver === 'undefined') return;
      const holder = document.getElementById('article-bgm-config');
      if (!holder) return;
      this.articleObserver = new MutationObserver(() => {
        this.queueApplyPageConfig();
      });
      this.articleObserver.observe(holder, {
        childList: true,
        characterData: true
      });
    }

    bindPjax() {
      if (!window.addEventListener) return;
      window.addEventListener('pjax:send', () => {
        if (this.articleTrack) {
          this.stopArticle({ resumeTheme: true });
        }
        window.__ARTICLE_BGM = null;
      });
      window.addEventListener('pjax:success', () => {
        window.__ARTICLE_BGM = null;
        this.queueApplyPageConfig();
      });
    }

    registerThemeHooks() {
      const reattach = () => {
        if (!this.articleTrack) {
          this.attachGestureTriggers(true);
        }
      };
      this.themeTrack.el.addEventListener('pause', reattach);
      this.themeTrack.el.addEventListener('ended', reattach);
    }
  }

  new BgmManager(themeTrack);
})();
</script>

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
    el.preload = 'none';
    el.loop = loop;
    el.volume = clampVolume(volume);
    const initialSrc = url || el.dataset.src || '';

    const ensureSource = newUrl => {
      const nextSrc = newUrl || initialSrc || el.dataset.src || '';
      if (!nextSrc) return false;
      if (el.currentSrc !== nextSrc && el.getAttribute('src') !== nextSrc) {
        el.src = nextSrc;
      }
      return true;
    };

    const load = newUrl => {
      if (!ensureSource(newUrl)) return Promise.resolve();
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
          el.removeEventListener('loadedmetadata', handleCanPlay);
          el.removeEventListener('error', handleError);
        };
        el.addEventListener('canplaythrough', handleCanPlay, { once: true });
        el.addEventListener('loadedmetadata', handleCanPlay, { once: true });
        el.addEventListener('error', handleError, { once: true });
      });
    };

    const play = opts => {
      if (opts) {
        if (typeof opts.loop !== 'undefined') el.loop = !!opts.loop;
        if (typeof opts.volume !== 'undefined') el.volume = clampVolume(opts.volume);
      }
      ensureSource();
      return el.play();
    };

    const pause = () => el.pause();
    const stop = () => {
      pause();
      if (el.src) {
        el.currentTime = 0;
      }
    };
    const destroy = () => {
      stop();
      if (!element) {
        el.removeAttribute('src');
        el.load();
      }
    };
    const isPlaying = () => !el.paused && !el.ended;

    return { el, load, play, pause, stop, destroy, isPlaying };
  };

  const createPlaylistTrack = ({ list = [], volume = 1, loopList = true } = {}) => {
    const el = new Audio();
    el.preload = 'none';
    el.volume = clampVolume(volume);

    let items = Array.isArray(list) ? list.slice() : [];
    let idx = 0;
    let looping = !!loopList;

    const hasItems = () => Array.isArray(items) && items.length > 0;
    const ensureSource = () => {
      if (!hasItems()) return false;
      const current = items[idx];
      if (current && current.url && el.getAttribute('src') !== current.url) {
        el.src = current.url;
      }
      el.loop = false;
      return !!(current && current.url);
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
      if (!hasItems()) {
        el.removeAttribute('src');
        el.load();
      }
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
      if (!ensureSource()) return false;
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
      if (el.src) {
        el.currentTime = 0;
      }
    };
    const destroy = () => {
      el.removeEventListener('ended', handleEnded);
      stop();
      el.removeAttribute('src');
      el.load();
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
      ensureSource();
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
    const pageBgmHolder = document.querySelector('[data-page-bgm]');
    const pageBgmRaw = pageBgmHolder && pageBgmHolder.dataset ? pageBgmHolder.dataset.pageBgm : '';
    if (pageBgmRaw) {
      try {
        return JSON.parse(pageBgmRaw);
      } catch (error) {
        console.warn('页面BGM配置解析失败', error);
      }
    }
    return typeof window.__ARTICLE_BGM !== 'undefined' && window.__ARTICLE_BGM !== null
      ? window.__ARTICLE_BGM
      : null;
  };

  const normalizeArticleConfig = raw => {
    if (!raw) return null;
    const normalizeItem = item => {
      const normalizeUrl = value => {
        if (!value || typeof value !== 'string') return null;
        const trimmed = value.trim();
        if (!trimmed) return null;
        if (/^(https?:)?\/\//i.test(trimmed)) return trimmed;
        if (trimmed.startsWith('/')) return trimmed;
        return `/${trimmed.replace(/^\/+/, '')}`;
      };

      if (!item) return null;
      if (typeof item === 'string') {
        const itemUrl = normalizeUrl(item);
        return itemUrl ? { url: itemUrl } : null;
      }
      if (item.url) {
        const itemUrl = normalizeUrl(item.url);
        return itemUrl ? { url: itemUrl } : null;
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
      this.themeVolume = track.el.volume;
      this.articleTrack = null;
      this.articleConfig = null;
      this.activeArticleId = null;
      this.lastConfigKey = null;
      this.isDucked = false;
      this.duckVolume = 0.5;
      this.volumeAnimationFrame = null;
      this.userUnlocked = !track.el.paused;
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
        await this.themeTrack.play({ volume: this.effectiveVolume(this.themeVolume) });
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
        const ok = await this.articleTrack.play({
          loopList: cfg.loopList,
          volume: this.effectiveVolume(cfg.volume)
        });
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

    effectiveVolume(baseVolume) {
      const base = clampVolume(baseVolume);
      return this.isDucked ? Math.min(base, this.duckVolume) : base;
    }

    activeTrack() {
      if (this.articleTrack && this.articleTrack.isPlaying()) return this.articleTrack;
      if (this.themeTrack.isPlaying()) return this.themeTrack;
      return this.articleTrack || this.themeTrack;
    }

    baseVolumeFor(track) {
      if (track === this.articleTrack && this.articleConfig) {
        return this.articleConfig.volume;
      }
      return this.themeVolume;
    }

    fadeTrackVolume(track, targetVolume, duration = 320) {
      if (!track || !track.el) return;
      const el = track.el;
      const target = clampVolume(targetVolume);
      const start = el.volume;
      if (this.volumeAnimationFrame) {
        cancelAnimationFrame(this.volumeAnimationFrame);
        this.volumeAnimationFrame = null;
      }
      if (duration <= 0 || Math.abs(start - target) < 0.01) {
        el.volume = target;
        return;
      }
      const startedAt = performance.now();
      const step = now => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.volume = clampVolume(start + (target - start) * eased);
        if (progress < 1) {
          this.volumeAnimationFrame = requestAnimationFrame(step);
        } else {
          this.volumeAnimationFrame = null;
        }
      };
      this.volumeAnimationFrame = requestAnimationFrame(step);
    }

    duck(volume = 0.5) {
      this.isDucked = true;
      this.duckVolume = clampVolume(volume);
      const track = this.activeTrack();
      this.fadeTrackVolume(track, this.effectiveVolume(this.baseVolumeFor(track)));
    }

    restoreVolume() {
      this.isDucked = false;
      const track = this.activeTrack();
      this.fadeTrackVolume(track, this.baseVolumeFor(track));
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

  window.__siteBgmManager = new BgmManager(themeTrack);
})();

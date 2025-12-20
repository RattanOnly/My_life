(() => {
  const cfg = window.__BACKGROUND_VIDEO__;
  if (!cfg || !cfg.enable) return;

  const isReducedMotion = () =>
    cfg.disable_on_reduced_motion &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isMobile = () => {
    if (!cfg.disable_on_mobile) return false;
    const viaUA = /Mobi|Android|iP(ad|hone|od)/i.test(navigator.userAgent || '');
    const viaMQ =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 767px)').matches;
    return viaUA || viaMQ;
  };

  if (isReducedMotion() || isMobile() || !cfg.src) return;

  const mount = () => {
    if (document.getElementById('background-video-layer')) return;

    const layer = document.createElement('div');
    layer.id = 'background-video-layer';
    layer.className = 'background-video-layer';
    layer.setAttribute('aria-hidden', 'true');

    const video = document.createElement('video');
    video.muted = cfg.muted !== false;
    video.autoplay = cfg.autoplay !== false;
    video.loop = cfg.loop !== false;
    video.playsInline = true;
    video.setAttribute('preload', 'auto');
    video.setAttribute('tabindex', '-1');
    if (cfg.poster) {
      video.poster = cfg.poster;
    }
    const source = document.createElement('source');
    source.src = cfg.src;
    source.type = 'video/mp4';
    video.appendChild(source);

    const overlay = document.createElement('div');
    overlay.className = 'background-video-overlay';
    if (cfg.overlay) {
      overlay.style.background = cfg.overlay;
    }

    const handleError = () => {
      layer.remove();
      document.body.classList.remove('has-background-video');
    };
    video.addEventListener('error', handleError, { once: true });

    layer.appendChild(video);
    layer.appendChild(overlay);
    document.body.insertBefore(layer, document.body.firstChild || null);
    document.body.classList.add('has-background-video');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();

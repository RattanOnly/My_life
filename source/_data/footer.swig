<audio id="site-bgm" src="/music/bgm.mp3" preload="auto" loop style="display:none;"></audio>
<script>
(() => {
  const bgm = document.getElementById('site-bgm');
  if (!bgm || window.__siteBgmInitialized) return;
  window.__siteBgmInitialized = true;

  const STORAGE_KEY = 'site_bgm_time';
  const resumeTime = parseFloat(sessionStorage.getItem(STORAGE_KEY));
  if (!Number.isNaN(resumeTime)) {
    bgm.currentTime = resumeTime;
  }

  const saveTime = () => sessionStorage.setItem(STORAGE_KEY, bgm.currentTime.toString());
  ['visibilitychange', 'pagehide', 'beforeunload'].forEach(event => {
    window.addEventListener(event, () => {
      if (event === 'visibilitychange' && !document.hidden) return;
      saveTime();
    }, { passive: true });
  });

  let started = !bgm.paused;
  const handleClick = () => {
    detachTriggers();
    tryPlay();
  };
  const handleTouch = event => {
    event.preventDefault();
    detachTriggers();
    tryPlay();
  };

  const detachTriggers = () => {
    document.removeEventListener('click', handleClick);
    document.removeEventListener('touchstart', handleTouch);
  };

  const attachTriggers = () => {
    document.addEventListener('click', handleClick, { once: true });
    document.addEventListener('touchstart', handleTouch, { once: true });
  };

  const tryPlay = () => {
    if (started) return;
    started = true;
    bgm.play().catch(() => {
      started = false;
      attachTriggers();
    });
  };

  attachTriggers();

  bgm.addEventListener('play', () => {
    started = true;
  });
  const handlePause = () => {
    started = false;
    attachTriggers();
  };
  bgm.addEventListener('pause', handlePause);
  bgm.addEventListener('ended', handlePause);
})();
</script>

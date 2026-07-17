(() => {
  if (window.__voiceNotePlayerInitialized) return;
  window.__voiceNotePlayerInitialized = true;

  const isVoiceNote = target => target instanceof HTMLAudioElement && target.matches('[data-voice-note]');
  const getManager = () => window.__siteBgmManager;

  document.addEventListener('play', event => {
    if (!isVoiceNote(event.target)) return;

    document.querySelectorAll('audio[data-voice-note]').forEach(player => {
      if (player !== event.target && !player.paused) player.pause();
    });

    const requestedVolume = Number(event.target.dataset.bgmDuckVolume);
    const duckVolume = Number.isFinite(requestedVolume) ? requestedVolume : 0.5;
    getManager()?.duck(duckVolume);
  }, true);

  const restoreBgm = event => {
    if (!isVoiceNote(event.target)) return;
    const hasPlayingVoiceNote = [...document.querySelectorAll('audio[data-voice-note]')]
      .some(player => !player.paused && !player.ended);
    if (!hasPlayingVoiceNote) getManager()?.restoreVolume();
  };

  document.addEventListener('pause', restoreBgm, true);
  document.addEventListener('ended', restoreBgm, true);
  window.addEventListener('pjax:send', () => getManager()?.restoreVolume());
})();

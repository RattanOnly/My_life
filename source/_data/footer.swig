{% if config.background_video %}
<script>
  window.__BACKGROUND_VIDEO__ = {{ config.background_video | dump | safe }};
</script>
<script src="/js/background-video.js"></script>
{% endif %}
<div
  id="visitor-online-count"
  class="visitor-online-count"
  data-endpoint="/online-count"
  data-presence-endpoint="/presence"
  data-visit-endpoint="/visits"
  data-heartbeat-interval-ms="60000"
  data-status="idle">
  当前在线：<span data-count>--</span> 人
</div>
<script src="/js/theme-effects.js"></script>
<script src="/js/visitor-online.js"></script>
<script src="/js/article-comments.js?v=20260703-modern-actions"></script>
<script src="/js/echo-character.js"></script>
<script src="/js/echo-chat.js?v=20260706-pjax-init"></script>
<audio id="site-bgm" data-src="https://assets.lovezvv.com/blog/music/blog-site-global-bgm.mp3" preload="none" loop style="position:fixed;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;"></audio>
<script src="/js/bgm-manager.js"></script>
<script src="/js/voice-note-player.js"></script>

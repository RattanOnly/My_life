---
title: Echo
date: 2026-07-04 00:00:00
type: echo
header: false
comments: false
---

<section
id="echo-page"
class="echo-page"
data-echo-chat-endpoint="/echo-chat"
data-echo-status-endpoint="/echo-status"
data-echo-stage="idle"
>
<div
class="echo-character"
data-echo-character
aria-hidden="true"
>
<img
class="echo-character-fallback"
data-echo-character-fallback
src="/echo/assets/echo-boy-fallback.svg"
alt=""
loading="eager"
decoding="async"
>
<div class="echo-thought" data-echo-thought>...</div>
</div>

<div class="echo-chat-panel">
<div class="echo-belt" aria-hidden="true"></div>
<p class="echo-identity">我不是他本人，只是这些文字里慢慢长出来的一点回声。你可以安心说，话会停在这次相遇里，不会被拿去给人翻看。</p>
<div class="echo-messages" data-echo-messages aria-live="polite"></div>
<form class="echo-form" data-echo-form onsubmit="return false">
<label for="echo-message">你想和这阵回声说什么</label>
<textarea id="echo-message" name="message" rows="4" maxlength="1000" required></textarea>
<div class="echo-form-actions">
<p class="echo-status" data-echo-status aria-live="polite"></p>
<button type="submit" class="ui-button" data-echo-submit>发送</button>
</div>
</form>
</div>
</section>

<script src="/js/echo-character.js"></script>
<script src="/js/echo-chat.js"></script>

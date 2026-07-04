---
title: Echo
date: 2026-07-04 00:00:00
type: echo
comments: false
---

<section
id="echo-page"
class="echo-page"
data-echo-chat-endpoint="/echo-chat"
data-echo-status-endpoint="/echo-status"
data-echo-stage="idle_sit"
>
<div class="echo-scene" aria-hidden="true">
<div class="echo-boy" data-echo-boy>
<div class="echo-boy-head"></div>
<div class="echo-boy-pack"></div>
<div class="echo-boy-body"></div>
<div class="echo-boy-leg echo-boy-leg-left"></div>
<div class="echo-boy-leg echo-boy-leg-right"></div>
<div class="echo-boy-shadow"></div>
</div>
<div class="echo-thought">...</div>
</div>

<div class="echo-chat-panel">
<div class="echo-belt" aria-hidden="true"></div>
<p class="echo-identity">这里不是他本人，只是一些从他的文字里长出来的回声。你的对话不会被保存。</p>
<div class="echo-messages" data-echo-messages aria-live="polite"></div>
<form class="echo-form" data-echo-form>
<label for="echo-message">你想和这阵回声说什么</label>
<textarea id="echo-message" name="message" rows="4" maxlength="1000" required></textarea>
<div class="echo-form-actions">
<p class="echo-status" data-echo-status aria-live="polite"></p>
<button type="submit" class="ui-button">发送</button>
</div>
</form>
</div>
</section>

<script src="/js/echo-chat.js"></script>

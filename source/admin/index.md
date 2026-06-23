---
title: 后台管理
date: 2026-06-23 00:00:00
type: admin
comments: false
---

<section
id="admin-dashboard"
class="admin-dashboard"
data-admin-data-endpoint="/admin-data"
data-admin-comments-endpoint="/admin-comments"
>
<form class="admin-login" data-admin-login>
<label>
管理员密码
<input type="password" name="password" autocomplete="current-password" required>
</label>
<button type="submit">进入后台</button>
</form>

<p class="admin-status" data-admin-status></p>

<div class="admin-content" data-admin-content hidden>
<section class="admin-section">
<h2>当前在线</h2>
<p class="admin-online-count"><span data-admin-online-count>--</span> 人</p>
</section>

<section class="admin-section">
<h2>最近访问</h2>
<div class="admin-table-wrap">
<table class="admin-table">
<thead>
<tr>
<th>时间</th>
<th>IP</th>
<th>页面</th>
<th>设备</th>
</tr>
</thead>
<tbody data-admin-visitor-logs></tbody>
</table>
</div>
</section>

<section class="admin-section">
<h2>评论管理</h2>
<div data-admin-comments></div>
</section>
</div>
</section>

<script src="/js/admin-dashboard.js"></script>

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
data-admin-owner-ip-marks-endpoint="/admin-owner-ip-marks"
data-admin-clear-visits-endpoint="/admin-visits"
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
<div class="admin-actions">
<button type="button" data-admin-refresh>刷新</button>
<button type="button" data-admin-logout>退出</button>
</div>

<section class="admin-section">
<h2>当前在线</h2>
<p class="admin-online-count"><span data-admin-online-count>--</span> 人</p>
</section>

<section class="admin-section">
<h2>最近访问</h2>
<form class="admin-filter-form" data-admin-visitor-filters>
<label>
开始日期
<input type="date" name="visitorFrom">
</label>
<label>
结束日期
<input type="date" name="visitorTo">
</label>
<label>
访客类型
<select name="visitorOwner">
<option value="">全部</option>
<option value="visitor">访客</option>
<option value="owner">本机</option>
</select>
</label>
<label>
页面关键词
<input type="search" name="visitorPageKeyword" autocomplete="off">
</label>
<div class="admin-filter-actions">
<button type="submit">筛选</button>
<button type="button" data-admin-visitor-filter-reset>重置</button>
<button type="button" data-admin-clear-visits>清空最近访问</button>
</div>
</form>
<div class="admin-table-wrap">
<table class="admin-table">
<thead>
<tr>
<th>时间</th>
<th>访客</th>
<th>位置</th>
<th>页面</th>
<th>设备</th>
<th>操作</th>
</tr>
</thead>
<tbody data-admin-visitor-logs></tbody>
</table>
</div>
<div class="admin-pagination" data-admin-visitor-pagination>
<button type="button" data-admin-visitor-page-prev>上一页</button>
<span data-admin-visitor-page-summary>第 1 页</span>
<button type="button" data-admin-visitor-page-next>下一页</button>
</div>
</section>

<section class="admin-section">
<h2>评论管理</h2>
<form class="admin-filter-form" data-admin-comment-filters>
<label>
开始日期
<input type="date" name="commentFrom">
</label>
<label>
结束日期
<input type="date" name="commentTo">
</label>
<label>
文章路径
<input type="search" name="commentArticlePathKeyword" autocomplete="off">
</label>
<label>
评论关键词
<input type="search" name="commentKeyword" autocomplete="off">
</label>
<div class="admin-filter-actions">
<button type="submit">筛选</button>
<button type="button" data-admin-comment-filter-reset>重置</button>
</div>
</form>
<div data-admin-comments></div>
<div class="admin-pagination" data-admin-comment-pagination>
<button type="button" data-admin-comment-page-prev>上一页</button>
<span data-admin-comment-page-summary>第 1 页</span>
<button type="button" data-admin-comment-page-next>下一页</button>
</div>
</section>
</div>
</section>

<script src="/js/admin-dashboard.js"></script>

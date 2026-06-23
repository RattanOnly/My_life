{% if page.layout === 'post' and page.musicList and page.musicList.length %}
<script id="article-bgm-config" type="application/json">
  {{ page.musicList | dump | safe }}
</script>
{% elif page.layout === 'post' and page.bgm %}
<script id="article-bgm-config" type="application/json">
  {{ page.bgm | dump | safe }}
</script>
{% endif %}

{% if page.layout === 'post' %}
<section
  id="article-comments"
  class="article-comments"
  data-endpoint="/comments"
  data-status="idle">
  <h3 class="article-comments-title">评论</h3>
  <div class="article-comments-list" data-comments-list></div>
  <form class="article-comments-form" data-comments-form>
    <label>
      <span>名字</span>
      <input name="name" type="text" maxlength="80" autocomplete="name" required>
    </label>
    <label>
      <span>邮箱</span>
      <input name="email" type="email" maxlength="160" autocomplete="email">
    </label>
    <label>
      <span>评论</span>
      <textarea name="body" maxlength="2000" rows="4" required></textarea>
    </label>
    <button type="submit">提交评论</button>
    <p class="article-comments-status" data-comments-status></p>
  </form>
</section>
{% endif %}

{% if page.layout === 'post' and page.musicList and page.musicList.length %}
<script id="article-bgm-config" type="application/json">
  {{ page.musicList | dump | safe }}
</script>
{% elif page.layout === 'post' and page.bgm %}
<script id="article-bgm-config" type="application/json">
  {{ page.bgm | dump | safe }}
</script>
{% endif %}

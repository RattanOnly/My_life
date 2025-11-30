<div class="site-author motion-element" itemprop="author" itemscope itemtype="http://schema.org/Person">
  {%- if theme.avatar.url %}
    <img class="site-author-image" itemprop="image" alt="{{ author }}"
      src="{{ url_for(theme.avatar.url) }}">
  {%- endif %}
  <p class="site-author-name" itemprop="name">{{ author }}</p>
  <div class="site-description" itemprop="description">{{ description }}</div>
</div>

{%- if theme.site_state %}
<div class="site-state-wrap motion-element">
  <nav class="site-state">
    {%- if site.posts.length > 0 %}
      {%- set archives_link = config.archive_dir %}
      {%- if theme.menu.archives %}
        {%- set archives_link = theme.menu.archives.split('||')[0] | trim %}
      {%- endif %}
      <div class="site-state-item site-state-posts">
        <a href="{{ url_for(archives_link) }}">
          <span class="site-state-item-count">{{ site.posts.length }}</span>
          <span class="site-state-item-name">{{ __('state.posts') }}</span>
        </a>
      </div>
    {%- endif %}

    {%- if site.categories.length > 0 %}
      {%- set categories_link = '/' + config.category_dir + '/' %}
      {%- if theme.menu.categories %}
        {%- set categories_link = theme.menu.categories.split('||')[0] | trim %}
      {%- endif %}
      <div class="site-state-item site-state-categories">
        <a href="{{ url_for(categories_link) }}">
          <span class="site-state-item-count">{{ site.categories.length }}</span>
          <span class="site-state-item-name">{{ __('state.categories') }}</span>
        </a>
      </div>
    {%- endif %}

    {%- if site.tags.length > 0 %}
      {%- set tags_link = '/' + config.tag_dir + '/' %}
      {%- if theme.menu.tags %}
        {%- set tags_link = theme.menu.tags.split('||')[0] | trim %}
      {%- endif %}
      <div class="site-state-item site-state-tags">
        <a href="{{ url_for(tags_link) }}">
          <span class="site-state-item-count">{{ site.tags.length }}</span>
          <span class="site-state-item-name">{{ __('state.tags') }}</span>
        </a>
      </div>
    {%- endif %}
  </nav>
</div>
{%- endif %}

{%- if theme.chat.enable and theme.chat.service !== '' %}
  <div class="sidebar-button motion-element">
  {%- if theme.chat.service == 'chatra' and theme.chatra.enable %}
    <a onclick="Chatra('openChat', true);">
  {%- endif %}
  {%- if theme.chat.service == 'tidio' and theme.tidio.enable %}
    <a onclick="tidioChatApi.open();">
  {%- endif %}
  {%- if theme.chat.icon %}<i class="{{ theme.chat.icon }}"></i>{%- endif %}
    {{ theme.chat.text }}
  </a>
  </div>
{%- endif %}

{%- if theme.social %}
  <div class="links-of-author motion-element">
    {%- for name, link in theme.social %}
      <span class="links-of-author-item">
      {%- set sidebarURL = link.split('||')[0] | trim %}
      {%- if theme.social_icons.enable %}
        {%- set sidebarIcon = '<i class="' + link.split('||')[1] | trim + ' fa-fw"></i>' %}
      {%- else %}
        {%- set sidebarIcon = '' %}
      {%- endif %}
      {%- if theme.social_icons.enable and theme.social_icons.icons_only %}
        {%- set sidebarText = '' %}
      {%- else %}
        {%- set sidebarText = name %}
      {%- endif %}
        {{ next_url(sidebarURL, sidebarIcon + sidebarText, {title: name + ' → ' + sidebarURL}) }}
      </span>
    {%- endfor %}
  </div>
{%- endif %}

{%- if theme.creative_commons.license and theme.creative_commons.sidebar %}
  <div class="cc-license motion-element" itemprop="license">
  {%- set ccImage = '<img src="' + url_for(theme.images + '/cc-' + theme.creative_commons.license + '.svg') + '" alt="Creative Commons">' %}
    {{ next_url(ccURL, ccImage, {class: 'cc-opacity'}) }}
  </div>
{%- endif %}

{# Blogroll #}
{%- if theme.links %}
  <div class="links-of-blogroll motion-element">
    <div class="links-of-blogroll-title">
      {%- if theme.links_settings.icon %}<i class="{{ theme.links_settings.icon }} fa-fw"></i>{%- endif %}
      {{ theme.links_settings.title }}
    </div>
    <ul class="links-of-blogroll-list">
      {%- for blogrollText, blogrollURL in theme.links %}
        <li class="links-of-blogroll-item">
          {{ next_url(blogrollURL, blogrollText, {title: blogrollURL}) }}
        </li>
      {%- endfor %}
    </ul>
  </div>
{%- endif %}

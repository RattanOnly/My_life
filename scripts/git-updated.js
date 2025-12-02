'use strict';

const { execSync } = require('child_process');
const path = require('path');

// Populate post.updated from git history so timestamps follow actual edits.
hexo.extend.filter.register('before_post_render', data => {
  if (!data || !data.full_source) return data;

  const relativePath = path.relative(hexo.base_dir, data.full_source);
  if (!relativePath) return data;

  try {
    const result = execSync(`git log -1 --format=%cI -- "${relativePath}"`, {
      cwd: hexo.base_dir,
      stdio: ['ignore', 'pipe', 'ignore']
    })
      .toString()
      .trim();

    if (result) data.updated = new Date(result);
  } catch (err) {
    hexo.log.debug('git-updated skipped for %s: %s', relativePath, err.message);
  }

  return data;
});

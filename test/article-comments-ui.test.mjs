import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('post body hook renders an Article Comment Area only for posts', async () => {
  const template = await readFile(new URL('../source/_data/post-body-end.swig', import.meta.url), 'utf8');

  assert.match(template, /page\.layout\s*===\s*'post'/);
  assert.match(template, /id="article-comments"/);
  assert.match(template, /data-endpoint="\/comments"/);
  assert.doesNotMatch(template, /workers\.dev/);
  assert.match(template, /我可以叫你什么/);
  assert.match(template, /name="name"[^>]*required/);
  assert.doesNotMatch(template, /name="email"/);
  assert.doesNotMatch(template, /邮箱/);
  assert.match(template, /留下你的印记/);
  assert.match(template, /name="body"[^>]*required/);
  assert.doesNotMatch(template, /\/js\/article-comments\.js/);
});

test('footer loads the Article Comment Area script for direct and PJAX navigation', async () => {
  const footer = await readFile(new URL('../source/_data/footer.swig', import.meta.url), 'utf8');

  assert.match(footer, /\/js\/article-comments\.js/);
});

test('article comments script loads, submits, and renders comments safely', async () => {
  const script = await readFile(new URL('../source/js/article-comments.js', import.meta.url), 'utf8');

  assert.match(script, /initArticleComments/);
  assert.match(script, /pjax:success/);
  assert.match(script, /dataset\.initialized\s*===\s*'true'/);
  assert.match(script, /fetch\(commentsUrl/);
  assert.match(script, /method:\s*'POST'/);
  assert.match(script, /replyParentId/);
  assert.match(script, /parentId/);
  assert.match(script, /localStorage/);
  assert.match(script, /deleteToken/);
  assert.match(script, /canDeleteUntil/);
  assert.match(script, /data-comment-id/);
  assert.match(script, /data-comment-reply/);
  assert.match(script, /article-comment-delete-button/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.match(script, /取消回复/);
  assert.match(script, /回复/);
  assert.match(script, /评论已删除/);
  assert.match(script, /article-comment-replies/);
  assert.doesNotMatch(script, /formData\.get\('email'\)/);
  assert.match(script, /谢谢你光顾我的人生！/);
  assert.match(script, /window\.location\.pathname/);
  assert.match(script, /data-comment-path-aliases/);
  assert.match(script, /textContent/);
  assert.doesNotMatch(script, /innerHTML/);
  assert.match(script, /catch\s*\(/);
  assert.match(script, /dataset\.status\s*=\s*'unavailable'/);
  assert.doesNotMatch(script, /throw new Error/);
});

test('article comments styles support one-level Comment Replies', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.article-comment-replies/);
  assert.match(styles, /\.article-comment-reply-button/);
  assert.match(styles, /\.article-comment-delete-button/);
  assert.match(styles, /\.article-comment-actions/);
  assert.match(styles, /\.article-comment-deleted/);
  assert.match(styles, /\.article-comments-replying/);
});

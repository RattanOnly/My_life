import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('admin page renders a private Visitor Admin Page shell', async () => {
  const page = await readFile(new URL('../source/admin/index.md', import.meta.url), 'utf8');

  assert.match(page, /title:\s*后台管理/);
  assert.match(page, /comments:\s*false/);
  assert.match(page, /id="admin-dashboard"/);
  assert.match(page, /data-admin-data-endpoint="\/admin-data"/);
  assert.match(page, /data-admin-comments-endpoint="\/admin-comments"/);
  assert.match(page, /data-admin-owner-ip-marks-endpoint="\/admin-owner-ip-marks"/);
  assert.match(page, /data-admin-clear-visits-endpoint="\/admin-visits"/);
  assert.match(page, /data-admin-refresh/);
  assert.match(page, /data-admin-logout/);
  assert.match(page, /data-admin-clear-visits/);
  assert.match(page, /data-admin-visitor-filters/);
  assert.match(page, /name="visitorFrom"/);
  assert.match(page, /name="visitorTo"/);
  assert.match(page, /name="visitorOwner"/);
  assert.match(page, /name="visitorPageKeyword"/);
  assert.match(page, /data-admin-visitor-filter-reset/);
  assert.match(page, /data-admin-visitor-pagination/);
  assert.match(page, /data-admin-visitor-page-prev/);
  assert.match(page, /data-admin-visitor-page-next/);
  assert.match(page, /data-admin-visitor-page-summary/);
  assert.match(page, /data-admin-comment-filters/);
  assert.match(page, /name="commentFrom"/);
  assert.match(page, /name="commentTo"/);
  assert.match(page, /name="commentArticlePathKeyword"/);
  assert.match(page, /name="commentKeyword"/);
  assert.match(page, /data-admin-comment-filter-reset/);
  assert.match(page, /data-admin-comment-pagination/);
  assert.match(page, /data-admin-comment-page-prev/);
  assert.match(page, /data-admin-comment-page-next/);
  assert.match(page, /data-admin-comment-page-summary/);
  assert.match(page, /<th>访客<\/th>/);
  assert.match(page, /<th>位置<\/th>/);
  assert.match(page, /<th>操作<\/th>/);
  assert.doesNotMatch(page, /<th>IP<\/th>/);
  assert.match(page, /<tbody data-admin-visitor-logs><\/tbody>/);
  assert.match(page, /<div data-admin-comments><\/div>/);
  assert.match(page, /\/js\/admin-dashboard\.js/);
  assert.doesNotMatch(page, /\n\s{4}<section class="admin-section">/);
});

test('admin dashboard script authenticates, loads owner data, and deletes comments', async () => {
  const script = await readFile(new URL('../source/js/admin-dashboard.js', import.meta.url), 'utf8');

  assert.match(script, /Authorization/);
  assert.match(script, /Bearer/);
  assert.match(script, /admin-data/);
  assert.match(script, /admin-comments/);
  assert.match(script, /method:\s*'DELETE'/);
  assert.match(script, /localStorage/);
  assert.match(script, /admin_dashboard_password/);
  assert.match(script, /data-admin-refresh/);
  assert.match(script, /data-admin-logout/);
  assert.match(script, /data-admin-clear-visits/);
  assert.match(script, /adminOwnerIpMarksEndpoint/);
  assert.match(script, /adminClearVisitsEndpoint/);
  assert.match(script, /visitorFilterState/);
  assert.match(script, /commentFilterState/);
  assert.match(script, /URLSearchParams/);
  assert.match(script, /visitorPageSize:\s*20/);
  assert.match(script, /commentPageSize:\s*20/);
  assert.match(script, /data-admin-visitor-filters/);
  assert.match(script, /data-admin-visitor-filter-reset/);
  assert.match(script, /data-admin-visitor-page-prev/);
  assert.match(script, /data-admin-visitor-page-next/);
  assert.match(script, /data-admin-comment-filters/);
  assert.match(script, /data-admin-comment-filter-reset/);
  assert.match(script, /data-admin-comment-page-prev/);
  assert.match(script, /data-admin-comment-page-next/);
  assert.match(script, /visitorLogsPagination/);
  assert.match(script, /commentsPagination/);
  assert.match(script, /markOwnerIp/);
  assert.match(script, /unmarkOwnerIp/);
  assert.match(script, /log\.isOwnerVisitor/);
  assert.match(script, /log\.visitorLocation/);
  assert.match(script, /formatVisitorLocation/);
  assert.match(script, /formatVisitedPage/);
  assert.match(script, /decodeURI/);
  assert.match(script, /本机/);
  assert.doesNotMatch(script, /appendCell\(row,\s*log\.visitorLocation\s*\|\|\s*'未知地区'\)/);
  assert.doesNotMatch(script, /appendCell\(row,\s*log\.visitedPage\)/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
});

test('admin dashboard styles keep Visitor Log filters and pagination compact', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /\.admin-filter-form/);
  assert.match(styles, /\.admin-pagination/);
  assert.match(styles, /min-height:\s*44px/);
  assert.match(styles, /overflow-x:\s*auto/);
  assert.match(styles, /@media\s+\(max-width:\s*700px\)/);
});

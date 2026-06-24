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
  assert.match(script, /markOwnerIp/);
  assert.match(script, /unmarkOwnerIp/);
  assert.match(script, /log\.isOwnerVisitor/);
  assert.match(script, /log\.visitorLocation/);
  assert.match(script, /本机/);
  assert.doesNotMatch(script, /innerHTML\s*=/);
});

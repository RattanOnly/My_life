import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('Visitor operations documentation covers deployment, configuration, verification, and troubleshooting', async () => {
  const doc = await readFile(new URL('../docs/visitor-state-sidecar.md', import.meta.url), 'utf8');

  for (const section of [
    '## Deployment',
    '## D1 Binding',
    '## Static Blog Configuration',
    '## Article Comments',
    '## Visitor Admin Page',
    '## Verification Checklist',
    '## Troubleshooting',
    '## Privacy Boundaries'
  ]) {
    assert.match(doc, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  for (const requiredText of [
    'Public pages call the Worker directly',
    'https://my-life-visitor-state.windking566.workers.dev/comments',
    'https://my-life-visitor-state.windking566.workers.dev/online-count',
    'anonymous browser Visitor ID',
    'wrangler deploy --config worker/wrangler.toml',
    'd1 migrations apply my-life-visitor-state --remote',
    'ADMIN_PASSWORD',
    'netlify.toml',
    '/comments',
    '/online-count',
    '/admin/',
    '/admin-data',
    '/admin-comments',
    '/admin-owner-ip-marks',
    '/admin-visits',
    'Visitor Log Retention is 30 days',
    'latest 50 Visitor Logs',
    'Refresh reloads the latest admin data without a browser refresh',
    'Logout forgets the saved Admin Password',
    'Mark Local labels an owner IP as local',
    'Clear Visitor Logs removes Visitor Logs without deleting comments or Online Visitor Count state',
    'Do not commit real secrets'
  ]) {
    assert.match(doc, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.doesNotMatch(doc, /Public pages call same-origin paths, and Netlify forwards them to the Worker/);
});

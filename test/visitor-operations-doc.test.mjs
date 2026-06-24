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
    'wrangler deploy --config worker/wrangler.toml',
    'd1 migrations apply my-life-visitor-state --remote',
    'ADMIN_PASSWORD',
    'netlify.toml',
    '/comments',
    '/online-count',
    '/admin/',
    '/admin-data',
    '/admin-comments',
    'Visitor Log Retention is 90 days',
    'Do not commit real secrets'
  ]) {
    assert.match(doc, new RegExp(requiredText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

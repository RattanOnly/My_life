import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('theme effects default to the 3D falling leaves scene', async () => {
  const script = await readFile(new URL('../source/js/theme-effects.js', import.meta.url), 'utf8');

  assert.match(script, /DEFAULT_EFFECT_ID\s*=\s*'leaves'/);
  assert.match(script, /site-effect--leaves/);
  assert.match(script, /leaf-scene/);
  assert.match(script, /numLeaves:\s*isSmallScreen\(\)\s*\?\s*16\s*:\s*28/);
  assert.match(script, /requestAnimationFrame/);
  assert.match(script, /cancelAnimationFrame/);
  assert.match(script, /transformStyle/);
  assert.match(script, /rotateX/);
  assert.match(script, /wind/);
  assert.doesNotMatch(script, /Snowfall/);
  assert.doesNotMatch(script, /snowSymbols/);
  assert.doesNotMatch(script, /❅|❆|✻/);
});

test('theme effect styles define leaves without snow animation classes', async () => {
  const styles = await readFile(new URL('../source/_data/styles.styl', import.meta.url), 'utf8');

  assert.match(styles, /site-effect--leaves/);
  assert.match(styles, /leaf-scene/);
  assert.match(styles, /leaf-particle/);
  assert.match(styles, /transform-style:\s*preserve-3d/);
  assert.doesNotMatch(styles, /\.snow/);
  assert.doesNotMatch(styles, /snowfall/);
});

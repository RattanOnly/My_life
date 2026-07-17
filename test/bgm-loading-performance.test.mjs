import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { test } from 'node:test';

const shouldNotExist = async path => {
  await assert.rejects(
    access(new URL(path, import.meta.url), constants.F_OK),
    error => error && error.code === 'ENOENT',
    `${path} should not be kept in the deployable source tree`
  );
};

test('site BGM is lazy loaded from the external BGM manager script', async () => {
  const footer = await readFile(new URL('../source/_data/footer.swig', import.meta.url), 'utf8');

  assert.match(footer, /id="site-bgm"/);
  assert.match(footer, /data-src="https:\/\/assets\.lovezvv\.com\/blog\/music\/blog-site-global-bgm\.mp3"/);
  assert.match(footer, /preload="none"/);
  assert.doesNotMatch(footer, /id="site-bgm"[^>]*\ssrc=/);
  assert.match(footer, /\/js\/bgm-manager\.js/);
  assert.match(footer, /\/js\/voice-note-player\.js/);
  assert.doesNotMatch(footer, /class BgmManager/);
  assert.doesNotMatch(footer, /new Audio\(/);
});

test('voice note playback ducks and restores the active BGM', async () => {
  const template = await readFile(new URL('../source/_data/post-body-end.swig', import.meta.url), 'utf8');
  const manager = await readFile(new URL('../source/js/bgm-manager.js', import.meta.url), 'utf8');
  const player = await readFile(new URL('../source/js/voice-note-player.js', import.meta.url), 'utf8');

  assert.match(template, /data-voice-note/);
  assert.match(template, /data-bgm-duck-volume="0\.5"/);
  assert.match(template, /preload="metadata"/);
  assert.match(manager, /duck\(volume = 0\.5\)/);
  assert.match(manager, /restoreVolume\(\)/);
  assert.match(player, /getManager\(\)\?\.duck\(duckVolume\)/);
  assert.match(player, /getManager\(\)\?\.restoreVolume\(\)/);
});

test('BGM manager defers audio sources until playback is attempted', async () => {
  const script = await readFile(new URL('../source/js/bgm-manager.js', import.meta.url), 'utf8');

  assert.match(script, /preload\s*=\s*'none'/);
  assert.match(script, /dataset\.src/);
  assert.match(script, /dataset\.pageBgm/);
  assert.match(script, /ensureSource/);
  assert.match(script, /attachGestureTriggers/);
  assert.match(script, /pjax:send/);
  assert.match(script, /pjax:success/);
  assert.doesNotMatch(script, /preload\s*=\s*'auto'/);
  assert.doesNotMatch(script, /sessionStorage\.getItem\(UNLOCK_KEY\)\s*===\s*'1'\s*\|\|/);
});

test('unused local media assets are removed after the R2 migration', async () => {
  await shouldNotExist('../source/images/Resource/Avatar.jpg');
  await shouldNotExist('../source/images/Resource/eat.jpg');
  await shouldNotExist('../source/images/Resource/ally.png');
  await shouldNotExist('../source/music/Chrismas.mp3');
  await shouldNotExist('../source/video/Christmas.mp4');

  await access(new URL('../source/images/Resource/Avatar.png', import.meta.url), constants.F_OK);
  await access(new URL('../source/images/Resource/favicon.ico', import.meta.url), constants.F_OK);
});

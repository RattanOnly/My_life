import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { test } from 'node:test';

const R2_ASSET_ORIGIN = 'https://assets.lovezvv.com';

test('post images are served from the R2 blog image path', async () => {
  const files = await readdir(new URL('../source/_posts/', import.meta.url));
  const markdownFiles = files.filter(file => file.endsWith('.md'));

  let r2ImageReferences = 0;
  for (const file of markdownFiles) {
    const post = await readFile(new URL(`../source/_posts/${file}`, import.meta.url), 'utf8');
    const imageReferences = [...post.matchAll(/!\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)];

    for (const [, imageUrl] of imageReferences) {
      assert.ok(
        imageUrl.startsWith(`${R2_ASSET_ORIGIN}/blog/images/`),
        `${file} should use an R2 blog image URL instead of ${imageUrl}`
      );
      assert.match(imageUrl, /\.webp$/);
      r2ImageReferences += 1;
    }
  }

  assert.equal(r2ImageReferences, 42);
});

test('article and site music are served from the R2 blog music path', async () => {
  const footer = await readFile(new URL('../source/_data/footer.swig', import.meta.url), 'utf8');
  const echoPage = await readFile(new URL('../source/echo/index.md', import.meta.url), 'utf8');
  const files = await readdir(new URL('../source/_posts/', import.meta.url));
  const posts = await Promise.all(
    files
      .filter(file => file.endsWith('.md'))
      .map(file => readFile(new URL(`../source/_posts/${file}`, import.meta.url), 'utf8'))
  );

  const combined = [footer, ...posts].join('\n');
  assert.doesNotMatch(combined, /src="\/music\//);
  assert.doesNotMatch(combined, /url:\s*\/music\//);
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-site-global-bgm\\.mp3`));
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-blue-night-blue_night\\.mp3`));
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-me-me\\.mp3`));
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-now-and-before-now-and-before\\.mp3`));
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-close-your-eyes-and-breathe-breath\\.mp3`));
  assert.match(echoPage, new RegExp(`${R2_ASSET_ORIGIN}/blog/music/blog-echo-echo\\.mp3`));
  assert.match(combined, new RegExp(`${R2_ASSET_ORIGIN}/blog/audio/blog-close-your-eyes-and-breathe-eng-one\\.m4a`));
});

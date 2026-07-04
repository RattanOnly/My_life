import { dirname, join } from 'node:path';
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const riveRuntimePath = require.resolve('@rive-app/canvas-lite/rive.js');
const riveRuntimeDir = dirname(riveRuntimePath);
const targetDir = join(process.cwd(), 'source/vendor/rive');

const files = ['rive.js', 'rive.wasm', 'rive_fallback.wasm'];

await mkdir(targetDir, { recursive: true });

await Promise.all(
  files.map(fileName =>
    copyFile(join(riveRuntimeDir, fileName), join(targetDir, fileName))
  )
);

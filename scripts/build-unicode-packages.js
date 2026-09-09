import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const trieDir = path.join(root, 'src/packages/unicode-trie');
const propsDir = path.join(root, 'src/packages/unicode-properties');

function cleanDist(dir) {
  const dist = path.join(dir, 'dist');
  fs.rmSync(dist, { recursive: true, force: true });
  fs.mkdirSync(dist, { recursive: true });
}

async function buildDual({ dir, entryPoints, platform }) {
  const shared = {
    absWorkingDir: dir,
    entryPoints,
    bundle: true,
    platform,
    target: 'es2020',
    sourcemap: true,
    external: ['fflate'],
    logLevel: 'info',
  };

  await Promise.all([
    esbuild.build({
      ...shared,
      format: 'esm',
      outdir: 'dist',
      outExtension: { '.js': '.mjs' },
    }),
    esbuild.build({
      ...shared,
      format: 'cjs',
      outdir: 'dist',
      outExtension: { '.js': '.cjs' },
      // So require('@cantoo/unicode-trie') returns the class, not { default }.
      footer: {
        js: 'module.exports = module.exports.default ?? module.exports;',
      },
    }),
  ]);
}

cleanDist(trieDir);
cleanDist(propsDir);

await buildDual({
  dir: trieDir,
  entryPoints: ['index.js'],
  platform: 'neutral',
});

await buildDual({
  dir: trieDir,
  entryPoints: ['builder.js'],
  platform: 'node',
});

await buildDual({
  dir: propsDir,
  entryPoints: ['index.js'],
  // Bundle sibling unicode-trie so fontkit subpath users need no extra package.
  platform: 'neutral',
});

console.log('Built unicode-trie and unicode-properties (esm + cjs)');

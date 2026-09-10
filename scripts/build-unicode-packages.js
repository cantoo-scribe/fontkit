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

function copyTypes(dir, files) {
  for (const file of files) {
    fs.copyFileSync(path.join(dir, file), path.join(dir, 'dist', file));
  }
}

function umdFooter(globalName, unwrapDefault) {
  const unwrap = unwrapDefault
    ? `${globalName} = ${globalName}.default ?? ${globalName};`
    : '';
  return [
    unwrap,
    `if (typeof module === "object" && module.exports) {`,
    `  module.exports = ${globalName};`,
    `}`,
    `if (typeof define === "function" && define.amd) {`,
    `  define(function () { return ${globalName}; });`,
    `}`
  ].filter(Boolean).join('\n');
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
    logLevel: 'info'
  };

  await Promise.all([
    esbuild.build({
      ...shared,
      format: 'esm',
      outdir: 'dist',
      outExtension: { '.js': '.mjs' }
    }),
    esbuild.build({
      ...shared,
      format: 'cjs',
      outdir: 'dist',
      outExtension: { '.js': '.cjs' },
      // So require('@cantoo/unicode-trie') returns the class, not { default }.
      footer: {
        js: 'module.exports = module.exports.default ?? module.exports;'
      }
    })
  ]);
}

/**
 * @param {{ dir: string, entry: string, outfile: string, globalName: string, unwrapDefault?: boolean, platform?: string, external?: string[] }} opts
 */
async function buildUmd({
  dir,
  entry,
  outfile,
  globalName,
  unwrapDefault = false,
  platform = 'browser',
  external = ['fflate']
}) {
  await esbuild.build({
    absWorkingDir: dir,
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    globalName,
    platform,
    target: 'es2020',
    outfile: path.join(dir, outfile),
    sourcemap: true,
    external,
    logLevel: 'info',
    footer: {
      js: umdFooter(globalName, unwrapDefault)
    }
  });
}

cleanDist(trieDir);
cleanDist(propsDir);

await buildDual({
  dir: trieDir,
  entryPoints: ['index.js'],
  platform: 'neutral'
});

await buildDual({
  dir: trieDir,
  entryPoints: ['builder.js'],
  platform: 'node'
});

await buildDual({
  dir: propsDir,
  entryPoints: ['index.js'],
  // Bundle sibling unicode-trie so fontkit subpath users need no extra package.
  platform: 'neutral'
});

await buildUmd({
  dir: trieDir,
  entry: 'index.js',
  outfile: 'dist/index.umd.js',
  globalName: 'UnicodeTrie',
  unwrapDefault: true,
  // Bundle fflate for a self-contained CDN build.
  external: []
});

await buildUmd({
  dir: propsDir,
  entry: 'index.js',
  outfile: 'dist/index.umd.js',
  globalName: 'unicodeProperties',
  // Bundle trie + fflate for a self-contained CDN build.
  external: []
});

copyTypes(trieDir, ['index.d.ts', 'builder.d.ts']);
copyTypes(propsDir, ['index.d.ts']);

console.log('Built unicode-trie and unicode-properties (esm + cjs + umd + types)');

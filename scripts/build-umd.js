import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * @param {{ minify?: boolean, outfile: string }} opts
 */
async function buildUmd({ minify = false, outfile }) {
  await esbuild.build({
    absWorkingDir: root,
    entryPoints: ['src/index.js'],
    bundle: true,
    format: 'iife',
    globalName: 'fontkit',
    platform: 'browser',
    target: 'es2020',
    outfile: path.join(root, outfile),
    sourcemap: true,
    minify,
    logLevel: 'info',
    loader: {
      '.js': 'ts',
      '.trie': 'base64'
    },
    // Make the IIFE usable from CommonJS require() as well as <script> tags.
    footer: {
      js: [
        // Prefer the real default export object when present (named + default).
        'fontkit = fontkit.default ?? fontkit;',
        'if (typeof module === "object" && module.exports) {',
        '  module.exports = fontkit;',
        '}',
        'if (typeof define === "function" && define.amd) {',
        '  define(function () { return fontkit; });',
        '}'
      ].join('\n')
    }
  });

  console.log(`Built ${outfile}`);
}

await buildUmd({ outfile: 'dist/fontkit.umd.js' });
await buildUmd({ outfile: 'dist/fontkit.umd.min.js', minify: true });

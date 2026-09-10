import * as esbuild from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist/fontkit.umd.js');

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['src/index.js'],
  bundle: true,
  format: 'iife',
  globalName: 'fontkit',
  platform: 'browser',
  target: 'es2020',
  outfile: out,
  sourcemap: true,
  logLevel: 'info',
  loader: {
    '.js': 'ts',
    '.trie': 'base64'
  },
  // Make the IIFE usable from CommonJS require() as well as <script> tags.
  footer: {
    js: [
      'if (typeof module === "object" && module.exports) {',
      '  module.exports = fontkit;',
      '}',
      'if (typeof define === "function" && define.amd) {',
      '  define(function () { return fontkit; });',
      '}'
    ].join('\n')
  }
});

console.log('Built dist/fontkit.umd.js');

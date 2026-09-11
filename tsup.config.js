import { defineConfig } from 'tsup';

const shared = {
  sourcemap: true,
  clean: false,
  target: 'es2020',
  splitting: false,
  dts: false,
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      '.js': 'ts',
      '.trie': 'base64'
    };
  }
};

const umdFooter = [
  'fontkit = fontkit.default ?? fontkit;',
  'if (typeof module === "object" && module.exports) {',
  '  module.exports = fontkit;',
  '}',
  'if (typeof define === "function" && define.amd) {',
  '  define(function () { return fontkit; });',
  '}'
].join('\n');

/**
 * @param {{ minify?: boolean, entryName: string }} opts
 */
function umdBuild({ minify = false, entryName }) {
  return {
    ...shared,
    entry: { [entryName]: 'src/index.js' },
    format: ['iife'],
    globalName: 'fontkit',
    platform: 'browser',
    minify,
    outExtension() {
      return { js: '.js' };
    },
    esbuildOptions(options) {
      shared.esbuildOptions(options);
      options.footer = { js: umdFooter };
    }
  };
}

export default defineConfig([
  {
    ...shared,
    entry: { main: 'src/node.js' },
    format: ['cjs'],
    platform: 'node',
    outExtension() {
      return { js: '.cjs' };
    }
  },
  {
    ...shared,
    entry: { module: 'src/node.js' },
    format: ['esm'],
    platform: 'node',
    outExtension() {
      return { js: '.mjs' };
    }
  },
  {
    ...shared,
    entry: { browser: 'src/index.js' },
    format: ['cjs'],
    platform: 'browser',
    outExtension() {
      return { js: '.cjs' };
    }
  },
  {
    ...shared,
    entry: { 'browser-module': 'src/index.js' },
    format: ['esm'],
    platform: 'browser',
    outExtension() {
      return { js: '.mjs' };
    }
  },
  umdBuild({ entryName: 'fontkit.umd' }),
  umdBuild({ entryName: 'fontkit.umd.min', minify: true })
]);

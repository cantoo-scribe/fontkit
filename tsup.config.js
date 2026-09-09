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
      '.trie': 'base64',
    };
    options.tsconfigRaw = {
      compilerOptions: {
        experimentalDecorators: true,
      },
    };
  },
};

export default defineConfig([
  {
    ...shared,
    entry: { main: 'src/node.js' },
    format: ['cjs'],
    platform: 'node',
    outExtension() {
      return { js: '.cjs' };
    },
  },
  {
    ...shared,
    entry: { module: 'src/node.js' },
    format: ['esm'],
    platform: 'node',
    outExtension() {
      return { js: '.mjs' };
    },
  },
  {
    ...shared,
    entry: { browser: 'src/index.js' },
    format: ['cjs'],
    platform: 'browser',
    outExtension() {
      return { js: '.cjs' };
    },
  },
  {
    ...shared,
    entry: { 'browser-module': 'src/index.js' },
    format: ['esm'],
    platform: 'browser',
    outExtension() {
      return { js: '.mjs' };
    },
  },
]);

import { defineConfig } from 'tsup';

const shared = {
  sourcemap: true,
  clean: false,
  target: 'es2020',
  splitting: false,
  dts: false,
  bundle: true
};

/**
 * @param {string} name
 * @param {boolean} unwrapDefault
 */
function umdFooter(name, unwrapDefault) {
  return [
    unwrapDefault ? `${name} = ${name}.default ?? ${name};` : '',
    'if (typeof module === "object" && module.exports) {',
    `  module.exports = ${name};`,
    '}',
    'if (typeof define === "function" && define.amd) {',
    `  define(function () { return ${name}; });`,
    '}'
  ].filter(Boolean).join('\n');
}

/**
 * Dual ESM+CJS for a unicode package entry.
 * @param {{ dir: string, entry: string, platform: 'neutral' | 'node', external?: string[] }} opts
 */
function dualBuilds({ dir, entry, platform, external = ['fflate'] }) {
  const base = entry.replace(/\.js$/, '');
  return [
    {
      ...shared,
      entry: { [base]: `${dir}/${entry}` },
      outDir: `${dir}/dist`,
      format: ['esm'],
      platform,
      external,
      outExtension() {
        return { js: '.mjs' };
      }
    },
    {
      ...shared,
      entry: { [base]: `${dir}/${entry}` },
      outDir: `${dir}/dist`,
      format: ['cjs'],
      platform,
      external,
      outExtension() {
        return { js: '.cjs' };
      },
      // So require() returns the class / API object, not { default }.
      footer: {
        js: 'module.exports = module.exports.default ?? module.exports;'
      }
    }
  ];
}

/**
 * Self-contained IIFE for CDN.
 * @param {{ dir: string, entry: string, globalName: string, unwrapDefault?: boolean }} opts
 */
function umdBuild({ dir, entry, globalName, unwrapDefault = false }) {
  return {
    ...shared,
    entry: { 'index.umd': `${dir}/${entry}` },
    outDir: `${dir}/dist`,
    format: ['iife'],
    globalName,
    platform: 'browser',
    // Bundle fflate (and trie for properties) for a self-contained CDN build.
    noExternal: [/.*/],
    outExtension() {
      return { js: '.js' };
    },
    esbuildOptions(options) {
      options.footer = { js: umdFooter(globalName, unwrapDefault) };
    }
  };
}

const trieDir = 'src/packages/unicode-trie';
const propsDir = 'src/packages/unicode-properties';

export default defineConfig([
  ...dualBuilds({ dir: trieDir, entry: 'index.js', platform: 'neutral' }),
  ...dualBuilds({ dir: trieDir, entry: 'builder.js', platform: 'node' }),
  ...dualBuilds({ dir: propsDir, entry: 'index.js', platform: 'neutral' }),
  umdBuild({
    dir: trieDir,
    entry: 'index.js',
    globalName: 'UnicodeTrie',
    unwrapDefault: true
  }),
  umdBuild({
    dir: propsDir,
    entry: 'index.js',
    globalName: 'unicodeProperties'
  })
]);

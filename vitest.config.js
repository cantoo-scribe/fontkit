import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));

function trieBase64Plugin() {
  return {
    name: 'trie-base64',
    load(id) {
      if (id.endsWith('.trie')) {
        const base64 = fs.readFileSync(id, 'base64');
        return `export default ${JSON.stringify(base64)}`;
      }
    }
  };
}

function legacyDecoratorsPlugin() {
  return {
    name: 'legacy-decorators',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes(`${path.sep}src${path.sep}`) || !id.endsWith('.js')) {
        return null;
      }
      if (!code.includes('@')) {
        return null;
      }

      const result = esbuild.transformSync(code, {
        loader: 'ts',
        sourcefile: id,
        sourcemap: true,
        tsconfigRaw: {
          compilerOptions: {
            experimentalDecorators: true
          }
        }
      });

      return {
        code: result.code,
        map: result.map || null
      };
    }
  };
}

export default defineConfig({
  plugins: [trieBase64Plugin(), legacyDecoratorsPlugin()],
  resolve: {
    alias: {
      fontkit: path.join(root, 'src/node.js')
    }
  },
  test: {
    include: ['test/**/*.js'],
    exclude: ['test/data/**'],
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js']
    }
  }
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

export default defineConfig({
  plugins: [trieBase64Plugin()],
  resolve: {
    alias: {
      fontkit: path.join(root, 'src/node.js')
    }
  },
  test: {
    include: ['test/**/*.js'],
    exclude: ['test/data/**'],
    globals: true,
    environment: 'node'
  }
});

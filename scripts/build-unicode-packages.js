import { spawnSync } from 'node:child_process';
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

cleanDist(trieDir);
cleanDist(propsDir);

const result = spawnSync(
  process.execPath,
  [
    path.join(root, 'node_modules/tsup/dist/cli-default.js'),
    '--config',
    'tsup.unicode.config.js'
  ],
  { cwd: root, stdio: 'inherit' }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

copyTypes(trieDir, ['index.d.ts', 'builder.d.ts']);
copyTypes(propsDir, ['index.d.ts']);

console.log('Built unicode-trie and unicode-properties (esm + cjs + umd + types)');

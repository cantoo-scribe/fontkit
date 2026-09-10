import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'types/index.d.ts');
const distDir = path.join(root, 'dist');
const dest = path.join(distDir, 'index.d.ts');

fs.mkdirSync(distDir, { recursive: true });
fs.copyFileSync(src, dest);

// Node resolution: some tools look for dist/main.d.ts next to main.cjs
fs.copyFileSync(src, path.join(distDir, 'main.d.ts'));
fs.copyFileSync(src, path.join(distDir, 'module.d.ts'));
fs.copyFileSync(src, path.join(distDir, 'browser.d.ts'));
fs.copyFileSync(src, path.join(distDir, 'browser-module.d.ts'));
fs.copyFileSync(src, path.join(distDir, 'fontkit.umd.d.ts'));

console.log('Copied public typings to dist/');

#!/usr/bin/env node
/**
 * prepack: rewrite relative unicode-trie import → @cantoo/unicode-trie
 * postpack / restore: put the in-repo relative import back
 *
 * Usage (from this directory):
 *   node prepare-publish.js prepack
 *   node prepare-publish.js restore
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const indexPath = path.join(dir, 'index.js');
const backupPath = path.join(dir, 'index.js.prepack-bak');

const LOCAL = "from '../unicode-trie/index.js'";
const PUBLISHED = "from '@cantoo/unicode-trie'";

const mode = process.argv[2] || 'prepack';

if (mode === 'prepack') {
  const source = fs.readFileSync(indexPath, 'utf8');
  if (!source.includes(LOCAL)) {
    if (source.includes(PUBLISHED) && fs.existsSync(backupPath)) {
      console.log('prepare-publish: already rewritten');
      process.exit(0);
    }
    console.error('prepare-publish: relative unicode-trie import not found');
    process.exit(1);
  }
  fs.writeFileSync(backupPath, source);
  fs.writeFileSync(indexPath, source.replace(LOCAL, PUBLISHED));
  console.log('prepare-publish: rewrote import for pack/publish');
  process.exit(0);
}

if (mode === 'restore' || mode === 'postpack') {
  if (fs.existsSync(backupPath)) {
    fs.renameSync(backupPath, indexPath);
    console.log('prepare-publish: restored relative import');
  }
  process.exit(0);
}

console.error('usage: prepare-publish.js [prepack|restore]');
process.exit(1);

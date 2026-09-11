# @cantoo/unicode-trie

Maintained fork of [foliojs/unicode-trie](https://github.com/foliojs/unicode-trie), published as **`@cantoo/unicode-trie`**.

## What’s improved for users

- **TypeScript typings** included for the trie and the builder
- **CJS + ESM** — works with `require` and `import` (and `require()` gives you the class directly)
- **CDN / browser** — UMD build on unpkg / jsDelivr
- **Smaller, modern inflate stack** — uses **fflate** instead of `tiny-inflate` / `pako`
- Also available as `@cantoo/fontkit/unicode-trie` if you already depend on fontkit

## Usage

```js
import UnicodeTrie from '@cantoo/unicode-trie';
import UnicodeTrieBuilder from '@cantoo/unicode-trie/builder.js';

// CommonJS
const UnicodeTrie = require('@cantoo/unicode-trie');
```

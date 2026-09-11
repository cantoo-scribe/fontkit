# @cantoo/unicode-trie

Maintained fork of [foliojs/unicode-trie](https://github.com/foliojs/unicode-trie), published as **`@cantoo/unicode-trie`**.

## Changes in the @cantoo fork

- Published under the `@cantoo` scope (also re-exported from `@cantoo/fontkit/unicode-trie`)
- Compression via **fflate** instead of `tiny-inflate` / `pako`
- Dual **CJS + ESM** builds (`dist/index.cjs` / `.mjs`, plus `builder.js`)
- **UMD** bundle for CDN (`dist/index.umd.js`, `unpkg` / `jsdelivr`)
- Public **TypeScript** typings (`dist/index.d.ts`, `dist/builder.d.ts`)
- CJS `require()` returns the class directly (not `{ default: … }`)
- Built with the monorepo **tsup** pipeline alongside `@cantoo/fontkit`

## Usage

```js
import UnicodeTrie from '@cantoo/unicode-trie';
import UnicodeTrieBuilder from '@cantoo/unicode-trie/builder.js';

// CommonJS
const UnicodeTrie = require('@cantoo/unicode-trie');
```

Also available via `@cantoo/fontkit/unicode-trie` when fontkit is installed (no extra dependency).

# @cantoo/unicode-properties

Maintained fork of [foliojs/unicode-properties](https://github.com/foliojs/unicode-properties), published as **`@cantoo/unicode-properties`**.

## Changes in the @cantoo fork

- Published under the `@cantoo` scope (also re-exported from `@cantoo/fontkit/unicode-properties`)
- Built on the vendored `@cantoo/unicode-trie` (bundled into the published `dist`, no separate install required for the properties package itself)
- Dual **CJS + ESM** builds (`dist/index.cjs` / `.mjs`)
- **UMD** bundle for CDN (`dist/index.umd.js`, `unpkg` / `jsdelivr`) — self-contained (trie + fflate inlined)
- Public **TypeScript** typings (`dist/index.d.ts`) with named exports and a matching default export object
- CJS `require()` returns the API object directly (named helpers on `module.exports`)
- Built with the monorepo **tsup** pipeline alongside `@cantoo/fontkit`

## Usage

```js
import { getCategory, isMark } from '@cantoo/unicode-properties';

// CommonJS
const { getCategory, isMark } = require('@cantoo/unicode-properties');
```

Also available via `@cantoo/fontkit/unicode-properties` when fontkit is installed (no extra dependency).

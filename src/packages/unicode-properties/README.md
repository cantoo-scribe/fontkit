# @cantoo/unicode-properties

Maintained fork of [foliojs/unicode-properties](https://github.com/foliojs/unicode-properties), published as **`@cantoo/unicode-properties`**.

## What’s improved for users

- **TypeScript typings** included (named exports + default object)
- **CJS + ESM** — works with `require` and `import`
- **CDN / browser** — self-contained UMD build on unpkg / jsDelivr (no extra trie package to load)
- **One dependency surface** — the trie is bundled in `dist`, so consumers don’t juggle a separate unicode-trie install for this package
- Also available as `@cantoo/fontkit/unicode-properties` if you already depend on fontkit

## Usage

```js
import { getCategory, isMark } from '@cantoo/unicode-properties';

// CommonJS
const { getCategory, isMark } = require('@cantoo/unicode-properties');
```

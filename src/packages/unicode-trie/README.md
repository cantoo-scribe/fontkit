# @cantoo/unicode-trie

Fork of [foliojs/unicode-trie](https://github.com/foliojs/unicode-trie) using **fflate** instead of `tiny-inflate` / `pako`.

```js
import UnicodeTrie from '@cantoo/unicode-trie';
import UnicodeTrieBuilder from '@cantoo/unicode-trie/builder.js';

// CommonJS
const UnicodeTrie = require('@cantoo/unicode-trie');
```

Also available via `@cantoo/fontkit/unicode-trie` when fontkit is installed (no extra dependency).

# @cantoo/unicode-properties

Fork of [foliojs/unicode-properties](https://github.com/foliojs/unicode-properties), wired to `@cantoo/unicode-trie`.

In this monorepo the source imports the sibling trie via a relative path. `npm publish` runs `prepare-publish.js` to rewrite that import to `@cantoo/unicode-trie`.

```js
import { getCategory, isMark } from '@cantoo/unicode-properties';
```

Also available via `@cantoo/fontkit/unicode-properties` when fontkit is installed (no extra dependency).

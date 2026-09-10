/**
 * Public TypeScript API for `@cantoo/unicode-trie/builder.js`.
 */

import UnicodeTrie from './index.js';

declare class UnicodeTrieBuilder {
  initialValue: number;
  errorValue: number;
  highStart: number;
  constructor(initialValue?: number, errorValue?: number);
  set(codePoint: number, value: number): this;
  setRange(start: number, end: number, value: number, overwrite?: boolean): this;
  get(codePoint: number, fromLSCP?: boolean): number;
  freeze(): UnicodeTrie;
  toBuffer(): Buffer;
}

export default UnicodeTrieBuilder;

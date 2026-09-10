/**
 * Public TypeScript API for `@cantoo/unicode-trie`.
 */

export interface UnicodeTrieInit {
  data: Int32Array | Uint32Array;
  highStart: number;
  errorValue: number;
}

declare class UnicodeTrie {
  data: Uint32Array | Int32Array;
  highStart: number;
  errorValue: number;
  constructor(data: Uint8Array | Buffer | UnicodeTrieInit);
  get(codePoint: number): number;
}

export default UnicodeTrie;

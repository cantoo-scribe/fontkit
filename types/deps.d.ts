/**
 * Minimal Node Buffer surface used by unicode-trie / unicode-properties.
 * Avoids pulling the full `@types/node` lib into checkJs.
 */
interface Buffer extends Uint8Array {
  readUInt32LE(offset?: number): number;
  readUInt32BE(offset?: number): number;
  writeUInt32LE(value: number, offset?: number): number;
  writeUInt32BE(value: number, offset?: number): number;
  slice(start?: number, end?: number): Buffer;
}

declare const Buffer: {
  alloc(size: number, fill?: string | number | Uint8Array, encoding?: string): Buffer;
  from(arrayBuffer: ArrayBufferLike, byteOffset?: number, length?: number): Buffer;
  from(data: Uint8Array | readonly number[]): Buffer;
  from(str: string, encoding?: string): Buffer;
  isBuffer(obj: unknown): obj is Buffer;
};

declare module 'brotli/decompress.js' {
  /**
   * Decompress a brotli-compressed buffer.
   * @param buffer Compressed input
   * @param outputSize Expected decompressed size
   */
  export default function decompress(buffer: Uint8Array, outputSize?: number): Uint8Array | null;
}

declare module 'clone' {
  /**
   * Deep-clone a value.
   */
  export default function cloneDeep<T>(value: T): T;
}

declare module 'dfa' {
  /**
   * Compiled DFA payload (from `dfa/compile`). Matches runtime `node_modules/dfa`:
   * `{ stateTable, accepting, tags }` — not a named `{ start, states }` graph.
   *
   * Callers may pass a wider object that also carries app data (e.g. USE
   * `categories` / `decompositions`); only these three fields are read.
   */
  export interface StateMachineDefinition {
    stateTable: number[][];
    accepting: boolean[];
    tags: string[][];
  }

  /** Match yield: `[startIndex, endIndex, tags]` (inclusive end). */
  export type StateMachineMatch = [start: number, end: number, tags: string[]];

  export default class StateMachine {
    stateTable: number[][];
    accepting: boolean[];
    tags: string[][];
    constructor(definition: StateMachineDefinition);
    /**
     * Iterable matches over an indexed sequence (`length` + numeric index).
     * Strings and number arrays both work at runtime.
     * Indic/USE pass numeric category arrays; other callers may pass strings.
     */
    match(input: ArrayLike<string | number>): Iterable<StateMachineMatch>;
    apply(
      input: ArrayLike<string | number>,
      actions: Record<
        string,
        (start: number, end: number, slice: ArrayLike<string | number>) => void
      >
    ): void;
  }
}

declare module 'fast-deep-equal' {
  export default function equal(a: unknown, b: unknown): boolean;
}

declare module 'fflate' {
  export function inflateSync(data: Uint8Array, opts?: { out?: Uint8Array }): Uint8Array;
  export function unzlibSync(data: Uint8Array, opts?: { out?: Uint8Array }): Uint8Array;
  export function deflateSync(data: Uint8Array, opts?: { level?: number }): Uint8Array;
}

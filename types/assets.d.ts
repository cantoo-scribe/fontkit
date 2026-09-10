/**
 * `.trie` assets are loaded as base64 strings (see tsup `loader: { '.trie': 'base64' }`
 * and vitest `trie-base64` plugin), then passed to `decodeBase64`.
 */
declare module '*.trie' {
  const data: string;
  export default data;
}

declare module '*.json' {
  const value: unknown;
  export default value;
}

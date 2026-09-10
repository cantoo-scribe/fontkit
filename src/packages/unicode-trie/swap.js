const isBigEndian = (new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x12);

/**
 * @param {Uint8Array} b
 * @param {number} n
 * @param {number} m
 */
const swap = (b, n, m) => {
  let i = b[n];
  b[n] = b[m];
  b[m] = i;
};

/**
 * @param {Uint8Array} array
 */
const swap32 = (array) => {
  const len = array.length;
  for (let i = 0; i < len; i += 4) {
    swap(array, i, i + 3);
    swap(array, i + 1, i + 2);
  }
};

/**
 * Swap byte order of each 32-bit word in-place when running on a big-endian host,
 * so the trie data is little-endian as expected by the runtime.
 * @param {Uint8Array} array
 */
export const swap32LE = (array) => {
  if (isBigEndian) {
    swap32(array);
  }
};

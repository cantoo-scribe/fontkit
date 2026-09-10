import { inflateSync } from 'fflate';
import { swap32LE } from './swap.js';

/**
 * Pre-parsed trie payload (e.g. from UnicodeTrieBuilder.freeze).
 * @typedef {object} UnicodeTrieInit
 * @property {Int32Array | Uint32Array} data
 * @property {number} highStart
 * @property {number} errorValue
 */

/**
 * Duck-type Node Buffer (has LE/BE readers + slice), matching prior runtime checks.
 * @param {unknown} value
 * @returns {value is Buffer}
 */
function isNodeBuffer(value) {
  return (
    typeof value === 'object'
    && value !== null
    && 'readUInt32BE' in value
    && 'readUInt32LE' in value
    && 'slice' in value
    && typeof value.readUInt32BE === 'function'
    && typeof value.readUInt32LE === 'function'
    && typeof value.slice === 'function'
  );
}

// Shift size for getting the index-1 table offset.
const SHIFT_1 = 6 + 5;

// Shift size for getting the index-2 table offset.
const SHIFT_2 = 5;

// Difference between the two shift sizes,
// for getting an index-1 offset from an index-2 offset. 6=11-5
const SHIFT_1_2 = SHIFT_1 - SHIFT_2;

// Number of index-1 entries for the BMP. 32=0x20
// This part of the index-1 table is omitted from the serialized form.
const OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> SHIFT_1;

// Number of entries in an index-2 block. 64=0x40
const INDEX_2_BLOCK_LENGTH = 1 << SHIFT_1_2;

// Mask for getting the lower bits for the in-index-2-block offset. */
const INDEX_2_MASK = INDEX_2_BLOCK_LENGTH - 1;

// Shift size for shifting left the index array values.
// Increases possible data size with 16-bit index values at the cost
// of compactability.
// This requires data blocks to be aligned by DATA_GRANULARITY.
const INDEX_SHIFT = 2;

// Number of entries in a data block. 32=0x20
const DATA_BLOCK_LENGTH = 1 << SHIFT_2;

// Mask for getting the lower bits for the in-data-block offset.
const DATA_MASK = DATA_BLOCK_LENGTH - 1;

// The part of the index-2 table for U+D800..U+DBFF stores values for
// lead surrogate code _units_ not code _points_.
// Values for lead surrogate code _points_ are indexed with this portion of the table.
// Length=32=0x20=0x400>>SHIFT_2. (There are 1024=0x400 lead surrogates.)
const LSCP_INDEX_2_OFFSET = 0x10000 >> SHIFT_2;
const LSCP_INDEX_2_LENGTH = 0x400 >> SHIFT_2;

// Count the lengths of both BMP pieces. 2080=0x820
const INDEX_2_BMP_LENGTH = LSCP_INDEX_2_OFFSET + LSCP_INDEX_2_LENGTH;

// The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
// Length 32=0x20 for lead bytes C0..DF, regardless of SHIFT_2.
const UTF8_2B_INDEX_2_OFFSET = INDEX_2_BMP_LENGTH;
const UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6; // U+0800 is the first code point after 2-byte UTF-8

// The index-1 table, only used for supplementary code points, at offset 2112=0x840.
// Variable length, for code points up to highStart, where the last single-value range starts.
// Maximum length 512=0x200=0x100000>>SHIFT_1.
// (For 0x100000 supplementary code points U+10000..U+10ffff.)
//
// The part of the index-2 table for supplementary code points starts
// after this index-1 table.
//
// Both the index-1 table and the following part of the index-2 table
// are omitted completely if there is only BMP data.
const INDEX_1_OFFSET = UTF8_2B_INDEX_2_OFFSET + UTF8_2B_INDEX_2_LENGTH;

// The alignment size of a data block. Also the granularity for compaction.
const DATA_GRANULARITY = 1 << INDEX_SHIFT;

class UnicodeTrie {
  /**
   * @param {Uint8Array | Buffer | UnicodeTrieInit} data
   */
  constructor(data) {
    if (isNodeBuffer(data) || data instanceof Uint8Array) {
      // read binary format
      /** @type {Uint8Array} */
      let bytes;
      let uncompressedLength;
      if (isNodeBuffer(data)) {
        this.highStart = data.readUInt32LE(0);
        this.errorValue = data.readUInt32LE(4);
        uncompressedLength = data.readUInt32LE(8);
        // View past the 12-byte header (avoids Buffer.slice → Uint8Array assignability issues).
        bytes = new Uint8Array(data.buffer, data.byteOffset + 12, data.byteLength - 12);
      } else {
        const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        this.highStart = view.getUint32(0, true);
        this.errorValue = view.getUint32(4, true);
        uncompressedLength = view.getUint32(8, true);
        bytes = data.subarray(12);
      }

      // inflate the actual trie data (raw deflate, matching builder)
      bytes = inflateSync(bytes, { out: new Uint8Array(uncompressedLength) });

      // swap bytes from little-endian
      swap32LE(bytes);

      /**
       * Compacted index + data table.
       * @type {Uint32Array | Int32Array}
       */
      this.data = new Uint32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength >> 2);
    } else {
      // pre-parsed data
      /**
       * Compacted index + data table.
       * @type {Uint32Array | Int32Array}
       */
      this.data = data.data;
      /**
       * First code point of the final single-value range.
       * @type {number}
       */
      this.highStart = data.highStart;
      /**
       * Value returned for out-of-range code points.
       * @type {number}
       */
      this.errorValue = data.errorValue;
    }
  }

  /**
   * @param {number} codePoint
   * @returns {number}
   */
  get(codePoint) {
    let index;
    if ((codePoint < 0) || (codePoint > 0x10ffff)) {
      return this.errorValue;
    }

    if ((codePoint < 0xd800) || ((codePoint > 0xdbff) && (codePoint <= 0xffff))) {
      // Ordinary BMP code point, excluding leading surrogates.
      // BMP uses a single level lookup.  BMP index starts at offset 0 in the index.
      // data is stored in the index array itself.
      index = (this.data[codePoint >> SHIFT_2] << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    if (codePoint <= 0xffff) {
      // Lead Surrogate Code Point.  A Separate index section is stored for
      // lead surrogate code units and code points.
      //   The main index has the code unit data.
      //   For this function, we need the code point data.
      index = (this.data[LSCP_INDEX_2_OFFSET + ((codePoint - 0xd800) >> SHIFT_2)] << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    if (codePoint < this.highStart) {
      // Supplemental code point, use two-level lookup.
      index = this.data[(INDEX_1_OFFSET - OMITTED_BMP_INDEX_1_LENGTH) + (codePoint >> SHIFT_1)];
      index = this.data[index + ((codePoint >> SHIFT_2) & INDEX_2_MASK)];
      index = (index << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    return this.data[this.data.length - DATA_GRANULARITY];
  }
}

export default UnicodeTrie;

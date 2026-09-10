import * as r from 'restructure';
import { BigMetrics } from './EBDT';

/** @typedef {import('restructure').StructValue} StructValue */

let SBitLineMetrics = new r.Struct({
  ascender: r.int8,
  descender: r.int8,
  widthMax: r.uint8,
  caretSlopeNumerator: r.int8,
  caretSlopeDenominator: r.int8,
  caretOffset: r.int8,
  minOriginSB: r.int8,
  minAdvanceSB: r.int8,
  maxBeforeBL: r.int8,
  minAfterBL: r.int8,
  pad: new r.Reserved(r.int8, 2)
});

let CodeOffsetPair = new r.Struct({
  glyphCode: r.uint16,
  offset: r.uint16
});

/**
 * Spec: numOffsets = lastGlyphIndex - firstGlyphIndex + 2 (extra sentinel for last glyph size).
 * @param {StructValue} t
 * @returns {number}
 */
function glyphRangeOffsetCount(t) {
  let parent = /** @type {StructValue} */ (t.parent);
  return /** @type {number} */ (parent.lastGlyphIndex)
    - /** @type {number} */ (parent.firstGlyphIndex) + 2;
}

let IndexSubtable = new r.VersionedStruct(r.uint16, {
  header: {
    imageFormat: r.uint16,
    imageDataOffset: r.uint32
  },

  1: {
    offsetArray: new r.Array(r.uint32, glyphRangeOffsetCount)
  },

  2: {
    imageSize: r.uint32,
    bigMetrics: BigMetrics
  },

  3: {
    offsetArray: new r.Array(r.uint16, glyphRangeOffsetCount),
    // Format 3 pads to 32-bit alignment when the offset count is odd.
    pad: new r.Reserved(
      r.uint16,
      /** @param {StructValue} t @returns {number} */
      t => glyphRangeOffsetCount(t) % 2
    )
  },

  4: {
    numGlyphs: r.uint32,
    glyphArray: new r.Array(
      CodeOffsetPair,
      /** @param {StructValue} t @returns {number} */
      t => /** @type {number} */ (t.numGlyphs) + 1
    )
  },

  5: {
    imageSize: r.uint32,
    bigMetrics: BigMetrics,
    numGlyphs: r.uint32,
    glyphCodeArray: new r.Array(r.uint16, 'numGlyphs'),
    // Format 5 pads to 32-bit alignment when glyphCodeArray length is odd.
    pad: new r.Reserved(
      r.uint16,
      /** @param {StructValue} t @returns {number} */
      t => /** @type {number} */ (t.numGlyphs) % 2
    )
  }
});

let IndexSubtableRecord = new r.Struct({
  firstGlyphIndex: r.uint16,
  lastGlyphIndex: r.uint16,
  // Offset from the start of IndexSubTableList (OpenType IndexSubTableArray).
  subtable: new r.Pointer(r.uint32, IndexSubtable, { type: 'parent' })
});

/**
 * Wrapper so record pointers resolve relative to the list start.
 * process() on BitmapSizeTable unwraps `.tables` so the public shape stays an array.
 */
let IndexSubTableList = new r.Struct({
  tables: new r.Array(
    IndexSubtableRecord,
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (/** @type {StructValue} */ (t.parent).numberOfIndexSubTables)
  )
});

/**
 * @typedef {StructValue & {
 *   indexSubTableArray: { tables: StructValue[] } | StructValue[],
 *   numberOfIndexSubTables: number
 * }} BitmapSizeTableValue
 */

let BitmapSizeTable = new r.Struct({
  // Lazy: numberOfIndexSubTables is stored after this pointer in the binary layout.
  indexSubTableArray: new r.Pointer(r.uint32, IndexSubTableList, { type: 'parent', lazy: true }),
  indexTablesSize: r.uint32,
  numberOfIndexSubTables: r.uint32,
  colorRef: r.uint32,
  hori: SBitLineMetrics,
  vert: SBitLineMetrics,
  startGlyphIndex: r.uint16,
  endGlyphIndex: r.uint16,
  ppemX: r.uint8,
  ppemY: r.uint8,
  bitDepth: r.uint8,
  flags: new r.Bitfield(r.uint8, ['horizontal', 'vertical'])
});

BitmapSizeTable.process = function () {
  let self = /** @type {BitmapSizeTableValue} */ (this);
  // Access forces lazy decode now that numberOfIndexSubTables is available.
  let list = self.indexSubTableArray;
  if (list && !Array.isArray(list) && Array.isArray(list.tables)) {
    self.indexSubTableArray = list.tables;
  }
};

/** @type {import('restructure').Struct} */
export default new r.Struct({
  version: r.uint32, // 0x00020000
  numSizes: r.uint32,
  sizes: new r.Array(BitmapSizeTable, 'numSizes')
});

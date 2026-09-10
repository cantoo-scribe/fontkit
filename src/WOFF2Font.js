import * as r from 'restructure';
import brotli from 'brotli/decompress.js';
import TTFFont from './TTFFont';
import TTFGlyph, { Point } from './glyph/TTFGlyph';
import WOFF2Glyph from './glyph/WOFF2Glyph';
import WOFF2Directory from './tables/WOFF2Directory';
import { asciiDecoder } from './utils';

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('../types/fontkit').FontDirectory} FontDirectory */
/** @typedef {import('../types/fontkit').TableEntry} TableEntry */
/** @typedef {import('../types/fontkit').TransformedGlyf} TransformedGlyf */
/** @typedef {import('../types/fontkit').DecodedGlyf} DecodedGlyf */
/** @typedef {import('./glyph/Glyph').default} Glyph */

/**
 * Subclass of TTFFont that represents a TTF/OTF font compressed by WOFF2
 * See spec here: http://www.w3.org/TR/WOFF2/
 *
 * @property {number} [_dataPos] Byte offset of the compressed table data (set in `_decodeDirectory`).
 */
export default class WOFF2Font extends TTFFont {
  /** @type {string} */
  type = 'WOFF2';

  // NOTE: Do not declare `_dataPos` as a class field. It is assigned in
  // `_decodeDirectory()` during `super()`, and subclass field initializers
  // run *after* `super()` returns — which would wipe the real offset.

  /** @type {boolean | undefined} */
  _decompressed;
  /** @type {(TransformedGlyf | undefined)[] | undefined} */
  _transformedGlyphs;

  /**
   * @param {ArrayBufferView} buffer
   * @returns {boolean}
   */
  static probe(buffer) {
    let bytes
      = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return asciiDecoder.decode(bytes.subarray(0, 4)) === 'wOF2';
  }

  /** @returns {void} */
  _decodeDirectory() {
    this.directory = /** @type {FontDirectory} */ (
      /** @type {unknown} */ (WOFF2Directory.decode(this.stream))
    );
    this._dataPos = this.stream.pos;
  }

  /** @returns {void} */
  _decompress() {
    // decompress data and setup table offsets if we haven't already
    if (!this._decompressed) {
      let dataPos = this._dataPos;
      if (dataPos == null) {
        throw new Error('Missing WOFF2 data offset; directory was not decoded');
      }
      this.stream.pos = dataPos;
      let totalCompressedSize = this.directory.totalCompressedSize;
      if (totalCompressedSize == null) {
        throw new Error('Missing totalCompressedSize in WOFF2 directory');
      }
      let buffer = this.stream.readBuffer(totalCompressedSize);

      let decompressedSize = 0;
      let tableMap = this.directory.tables;
      for (let tag in tableMap) {
        let entry = tableMap[tag];
        if (!entry) {
          continue;
        }
        entry.offset = decompressedSize;
        decompressedSize += (entry.transformLength != null) ? entry.transformLength : entry.length;
      }

      let decompressed = brotli(
        buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength),
        decompressedSize
      );
      if (!decompressed) {
        throw new Error('Error decoding compressed data in WOFF2');
      }

      this._setStream(new r.DecodeStream(decompressed));
      this._decompressed = true;
    }
  }

  /**
   * @param {TableEntry} table
   * @returns {unknown}
   */
  _decodeTable(table) {
    this._decompress();
    return super._decodeTable(table);
  }

  // Override this method to get a glyph and return our
  // custom subclass if there is a glyf table.
  /**
   * @param {number} glyph
   * @param {number[]} [characters]
   * @returns {Glyph | null | undefined}
   */
  _getBaseGlyph(glyph, characters = []) {
    let cached = this._glyphs[glyph];
    if (cached && typeof (/** @type {{ _getContours?: unknown }} */ (cached))._getContours === 'function') {
      return cached;
    }

    let glyfEntry = this.directory.tables.glyf;
    if (glyfEntry && glyfEntry.transformed) {
      if (!this._transformedGlyphs) { this._transformGlyfTable(); }
      let outline = new WOFF2Glyph(glyph, characters, this);
      if (!cached) {
        this._glyphs[glyph] = outline;
      }
      return outline;
    }

    return super._getBaseGlyph(glyph, characters);
  }

  /** @returns {void} */
  _transformGlyfTable() {
    this._decompress();
    let glyfEntry = this.directory.tables.glyf;
    if (!glyfEntry) {
      this._transformedGlyphs = [];
      return;
    }
    this.stream.pos = glyfEntry.offset;
    let table = /** @type {GlyfTableDecoded} */ (GlyfTable.decode(this.stream));
    /** @type {TransformedGlyf[]} */
    let glyphs = [];

    for (let index = 0; index < table.numGlyphs; index++) {
      /** @type {TransformedGlyf} */
      let glyph = { numberOfContours: 0 };
      let nContours = table.nContours.readInt16BE();
      glyph.numberOfContours = nContours;

      if (nContours > 0) { // simple glyph
        /** @type {number[]} */
        let nPoints = [];
        let totalPoints = 0;

        for (let i = 0; i < nContours; i++) {
          let r = read255UInt16(table.nPoints);
          totalPoints += r;
          nPoints.push(totalPoints);
        }

        glyph.points = decodeTriplet(table.flags, table.glyphs, totalPoints);
        for (let i = 0; i < nContours; i++) {
          let pts = glyph.points;
          if (pts) {
            pts[nPoints[i] - 1].endContour = true;
          }
        }

        read255UInt16(table.glyphs);
      } else if (nContours < 0) { // composite glyph
        let haveInstructions = TTFGlyph.prototype._decodeComposite.call(
          /** @type {TTFGlyph} */ (/** @type {unknown} */ ({ _font: this })),
          /** @type {DecodedGlyf} */ (glyph),
          table.composites
        );
        if (haveInstructions) {
          read255UInt16(table.glyphs);
        }
      }

      glyphs.push(glyph);
    }

    this._transformedGlyphs = glyphs;
  }
}

/**
 * @typedef {{
 *   version: number,
 *   numGlyphs: number,
 *   nContours: DecodeStream,
 *   nPoints: DecodeStream,
 *   flags: DecodeStream,
 *   glyphs: DecodeStream,
 *   composites: DecodeStream
 * }} GlyfTableDecoded
 */

// Special class that accepts a length and returns a sub-stream for that data
class Substream {
  /**
   * @param {number | string} length
   */
  constructor(length) {
    this.length = length;
    this._buf = new r.Buffer(length);
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @returns {DecodeStream}
   */
  decode(stream, parent) {
    return new r.DecodeStream(this._buf.decode(stream, parent));
  }
}

// This struct represents the entire glyf table
let GlyfTable = new r.Struct({
  version: r.uint32,
  numGlyphs: r.uint16,
  indexFormat: r.uint16,
  nContourStreamSize: r.uint32,
  nPointsStreamSize: r.uint32,
  flagStreamSize: r.uint32,
  glyphStreamSize: r.uint32,
  compositeStreamSize: r.uint32,
  bboxStreamSize: r.uint32,
  instructionStreamSize: r.uint32,
  nContours: new Substream('nContourStreamSize'),
  nPoints: new Substream('nPointsStreamSize'),
  flags: new Substream('flagStreamSize'),
  glyphs: new Substream('glyphStreamSize'),
  composites: new Substream('compositeStreamSize'),
  bboxes: new Substream('bboxStreamSize'),
  instructions: new Substream('instructionStreamSize')
});

const WORD_CODE = 253;
const ONE_MORE_BYTE_CODE2 = 254;
const ONE_MORE_BYTE_CODE1 = 255;
const LOWEST_U_CODE = 253;

/**
 * @param {DecodeStream} stream
 * @returns {number}
 */
function read255UInt16(stream) {
  let code = stream.readUInt8();

  if (code === WORD_CODE) {
    return stream.readUInt16BE();
  }

  if (code === ONE_MORE_BYTE_CODE1) {
    return stream.readUInt8() + LOWEST_U_CODE;
  }

  if (code === ONE_MORE_BYTE_CODE2) {
    return stream.readUInt8() + LOWEST_U_CODE * 2;
  }

  return code;
}

/**
 * @param {number} flag
 * @param {number} baseval
 * @returns {number}
 */
function withSign(flag, baseval) {
  return flag & 1 ? baseval : -baseval;
}

/**
 * @param {DecodeStream} flags
 * @param {DecodeStream} glyphs
 * @param {number} nPoints
 * @returns {Point[]}
 */
function decodeTriplet(flags, glyphs, nPoints) {
  let y;
  let x = y = 0;
  /** @type {Point[]} */
  let res = [];

  for (let i = 0; i < nPoints; i++) {
    let dx = 0;
    let dy = 0;
    let flag = flags.readUInt8();
    let onCurve = !(flag >> 7);
    flag &= 0x7f;

    if (flag < 10) {
      dx = 0;
      dy = withSign(flag, ((flag & 14) << 7) + glyphs.readUInt8());
    } else if (flag < 20) {
      dx = withSign(flag, (((flag - 10) & 14) << 7) + glyphs.readUInt8());
      dy = 0;
    } else if (flag < 84) {
      let b0 = flag - 20;
      let b1 = glyphs.readUInt8();
      dx = withSign(flag, 1 + (b0 & 0x30) + (b1 >> 4));
      dy = withSign(flag >> 1, 1 + ((b0 & 0x0c) << 2) + (b1 & 0x0f));
    } else if (flag < 120) {
      let b0 = flag - 84;
      dx = withSign(flag, 1 + ((b0 / 12) << 8) + glyphs.readUInt8());
      dy = withSign(flag >> 1, 1 + (((b0 % 12) >> 2) << 8) + glyphs.readUInt8());
    } else if (flag < 124) {
      let b1 = glyphs.readUInt8();
      let b2 = glyphs.readUInt8();
      dx = withSign(flag, (b1 << 4) + (b2 >> 4));
      dy = withSign(flag >> 1, ((b2 & 0x0f) << 8) + glyphs.readUInt8());
    } else {
      dx = withSign(flag, glyphs.readUInt16BE());
      dy = withSign(flag >> 1, glyphs.readUInt16BE());
    }

    x += dx;
    y += dy;
    res.push(new Point(onCurve, false, x, y));
  }

  return res;
}

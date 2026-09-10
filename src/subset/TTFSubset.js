import cloneDeep from 'clone';
import Subset from './Subset';
import Directory from '../tables/directory';
import TTFGlyphEncoder from '../glyph/TTFGlyphEncoder';

/** @typedef {import('../../types/fontkit').SubsetFont} SubsetFont */
/** @typedef {import('../../types/fontkit').DecodedGlyf} DecodedGlyf */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @typedef {{ advance: number, bearing: number }} HmtxMetric
 */

export default class TTFSubset extends Subset {
  /** @type {TTFGlyphEncoder} */
  glyphEncoder;
  /** @type {Uint8Array[] | null} */
  glyf = null;
  /** @type {number} */
  offset = 0;
  /** @type {{ offsets: number[], version: number } | null} */
  loca = null;
  /** @type {{ metrics: HmtxMetric[], bearings: number[] } | null} */
  hmtx = null;

  /**
   * @param {SubsetFont} font
   */
  constructor(font) {
    super(font);
    this.glyphEncoder = new TTFGlyphEncoder();
  }

  /**
   * @param {number} gid
   * @returns {number}
   */
  _addGlyph(gid) {
    let glyph = this.font.getGlyph(gid);
    if (!glyph || !glyph._decode) {
      throw new Error(`Cannot decode glyph ${gid}`);
    }
    let glyf = glyph._decode();

    if (!this.font.loca) {
      throw new Error('Font missing loca table');
    }

    // get the offset to the glyph from the loca table
    let curOffset = this.font.loca.offsets[gid];
    let nextOffset = this.font.loca.offsets[gid + 1];

    let stream = this.font._getTableStream('glyf');
    if (!stream) {
      throw new Error('Font missing glyf table');
    }
    stream.pos += curOffset;

    let raw = stream.readBuffer(nextOffset - curOffset);
    /** @type {Uint8Array} */
    let buffer = raw instanceof Uint8Array
      ? raw
      : Uint8Array.from(/** @type {Iterable<number>} */ (/** @type {unknown} */ (raw)));

    // if it is a compound glyph, include its components
    if (glyf && glyf.numberOfContours < 0) {
      buffer = new Uint8Array(buffer);
      let ab = buffer.buffer instanceof ArrayBuffer ? buffer.buffer : new Uint8Array(buffer).buffer;
      let view = new DataView(ab, buffer.byteOffset, buffer.byteLength);
      for (let component of glyf.components || []) {
        gid = this.includeGlyph(component.glyphID);
        view.setUint16(component.pos, gid);
      }
    } else if (glyf && this.font._variationProcessor) {
      // If this is a TrueType variation glyph, re-encode the path
      let encoded = this.glyphEncoder.encodeSimple(
        /** @type {import('../glyph/Path').default} */ (/** @type {unknown} */ (glyph.path)),
        glyf.instructions
      );
      buffer = encoded instanceof Uint8Array
        ? encoded
        : Uint8Array.from(/** @type {Iterable<number>} */ (/** @type {unknown} */ (encoded)));
    }

    if (!this.glyf || !this.loca || !this.hmtx) {
      throw new Error('TTFSubset.encode must initialize glyf/loca/hmtx before _addGlyph');
    }

    this.glyf.push(buffer);
    this.loca.offsets.push(this.offset);

    this.hmtx.metrics.push({
      advance: glyph.advanceWidth,
      bearing: glyph._getMetrics().leftBearing
    });

    this.offset += buffer.byteLength;
    return this.glyf.length - 1;
  }

  /**
   * @returns {BinaryBuffer}
   */
  encode() {
    // tables required by PDF spec:
    //   head, hhea, loca, maxp, cvt , prep, glyf, hmtx, fpgm
    //
    // additional tables required for standalone fonts:
    //   name, cmap, OS/2, post

    /** @type {Uint8Array[]} */
    this.glyf = [];
    this.offset = 0;
    this.loca = {
      offsets: /** @type {number[]} */ ([]),
      version: this.font.loca ? (this.font.loca.version ?? 0) : 0
    };

    this.hmtx = {
      metrics: /** @type {HmtxMetric[]} */ ([]),
      bearings: /** @type {number[]} */ ([])
    };

    // include all the glyphs
    // not using a for loop because we need to support adding more
    // glyphs to the array as we go, and CoffeeScript caches the length.
    let i = 0;
    while (i < this.glyphs.length) {
      this._addGlyph(this.glyphs[i++]);
    }

    let maxp = cloneDeep(this.font.maxp);
    if (maxp && typeof maxp === 'object') {
      /** @type {StructValue} */ (maxp).numGlyphs = this.glyf.length;
    }

    let loca = this.loca;
    loca.offsets.push(this.offset);

    let head = cloneDeep(this.font.head);
    if (head && typeof head === 'object') {
      /** @type {StructValue} */ (head).indexToLocFormat = loca.version;
    }

    let hhea = cloneDeep(this.font.hhea);
    if (hhea && typeof hhea === 'object') {
      /** @type {StructValue} */ (hhea).numberOfMetrics = this.hmtx.metrics.length;
    }

    // TODO: subset prep, cvt, fpgm?
    // The following is the minimum set of tables.
    /** @type {Record<string, unknown>} */
    let t = {
      head,
      hhea,
      loca: this.loca,
      maxp,
      'cvt ': this.font['cvt '],
      prep: this.font.prep,
      glyf: this.glyf,
      hmtx: this.hmtx,
      fpgm: this.font.fpgm
    };

    let fontTables = /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this.font));
    for (const tag of this.includedTables) {
      t[tag] = cloneDeep(fontTables[tag]);
    }

    return Directory.toBuffer({ tables: t });
  }
}

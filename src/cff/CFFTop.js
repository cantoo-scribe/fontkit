import * as r from 'restructure';
import { resolveLength } from 'restructure';
import CFFDict from './CFFDict';
import CFFIndex from './CFFIndex';
import CFFPointer from './CFFPointer';
import CFFPrivateDict from './CFFPrivateDict';
import { StandardEncoding, ExpertEncoding } from './CFFEncodings';
import { ISOAdobeCharset, ExpertCharset, ExpertSubsetCharset } from './CFFCharsets';
import { ItemVariationStore } from '../tables/variations';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').CFFEncodeContext} CFFEncodeContext */

/**
 * @param {StructValue} t
 * @returns {number}
 */
function charStringsCount(t) {
  let parent = t.parent;
  if (!parent) {
    return 0;
  }
  let cs = parent.CharStrings;
  if (cs && typeof cs === 'object' && 'length' in cs && typeof /** @type {{ length: unknown }} */ (cs).length === 'number') {
    return /** @type {{ length: number }} */ (cs).length;
  }
  return 0;
}

// Checks if an operand is an index of a predefined value,
// otherwise delegates to the provided type.
class PredefinedOp {
  /**
   * @param {unknown[]} predefinedOps
   * @param {BaseType} type
   */
  constructor(predefinedOps, type) {
    /** @type {unknown[]} */
    this.predefinedOps = predefinedOps;
    /** @type {BaseType} */
    this.type = type;
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @param {number[]} operands
   * @returns {unknown}
   */
  decode(stream, parent, operands) {
    if (this.predefinedOps[operands[0]] != null) {
      return this.predefinedOps[operands[0]];
    }

    if (!this.type.decode) {
      throw new Error('PredefinedOp type must implement decode()');
    }
    return this.type.decode(stream, parent, operands);
  }

  /**
   * @param {unknown} value
   * @param {StructValue | null | undefined} ctx
   * @returns {unknown}
   */
  size(value, ctx) {
    if (!this.type.size) {
      throw new Error('PredefinedOp type must implement size()');
    }
    return this.type.size(value, ctx);
  }

  /**
   * @param {EncodeStream | null} stream
   * @param {unknown} value
   * @param {StructValue | null | undefined} ctx
   * @returns {unknown[]}
   */
  encode(stream, value, ctx) {
    let index = this.predefinedOps.indexOf(value);
    if (index !== -1) {
      // Must be an operand list — CFFDict iterates with for-of.
      return [index];
    }

    if (!this.type.encode) {
      throw new Error('PredefinedOp type must implement encode()');
    }
    let encoded = this.type.encode(stream, value, ctx);
    return Array.isArray(encoded) ? encoded : [encoded];
  }
}

class CFFEncodingVersion extends r.Number {
  constructor() {
    super('UInt8');
  }

  /**
   * @param {DecodeStream} stream
   * @returns {number}
   */
  decode(stream) {
    return r.uint8.decode(stream) & 0x7f;
  }
}

let Range1 = new r.Struct({
  first: r.uint16,
  nLeft: r.uint8
});

let Range2 = new r.Struct({
  first: r.uint16,
  nLeft: r.uint16
});

let CFFCustomEncoding = new r.VersionedStruct(new CFFEncodingVersion(), {
  0: {
    nCodes: r.uint8,
    codes: new r.Array(r.uint8, 'nCodes')
  },

  1: {
    nRanges: r.uint8,
    ranges: new r.Array(Range1, 'nRanges')
  }

  // TODO: supplement?
});

let CFFEncoding = new PredefinedOp([StandardEncoding, ExpertEncoding], new CFFPointer(CFFCustomEncoding, { lazy: true }));

// Decodes an array of ranges until the total
// length is equal to the provided length.
class RangeArray extends r.Array {
  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @returns {Array<StructValue & { nLeft: number, offset: number }>}
   */
  decode(stream, parent) {
    if (this.length == null) {
      throw new Error('RangeArray requires a length');
    }
    let length = resolveLength(this.length, stream, parent);
    let count = 0;
    /** @type {Array<StructValue & { nLeft: number, offset: number }>} */
    let res = [];
    while (count < length) {
      if (!this.type.decode) {
        throw new Error('RangeArray element type must implement decode()');
      }
      let range = /** @type {StructValue & { nLeft: number, offset?: number }} */ (
        this.type.decode(stream, parent)
      );
      range.offset = count;
      count += range.nLeft + 1;
      res.push(/** @type {StructValue & { nLeft: number, offset: number }} */ (range));
    }

    return res;
  }
}

let CFFCustomCharset = new r.VersionedStruct(r.uint8, {
  0: {
    glyphs: new r.Array(r.uint16, t => charStringsCount(t) - 1)
  },

  1: {
    ranges: new RangeArray(Range1, t => charStringsCount(t) - 1)
  },

  2: {
    ranges: new RangeArray(Range2, t => charStringsCount(t) - 1)
  }
});

let CFFCharset = new PredefinedOp([ISOAdobeCharset, ExpertCharset, ExpertSubsetCharset], new CFFPointer(CFFCustomCharset, { lazy: true }));

let FDRange3 = new r.Struct({
  first: r.uint16,
  fd: r.uint8
});

let FDRange4 = new r.Struct({
  first: r.uint32,
  fd: r.uint16
});

let FDSelect = new r.VersionedStruct(r.uint8, {
  0: {
    fds: new r.Array(r.uint8, t => charStringsCount(t))
  },

  3: {
    nRanges: r.uint16,
    ranges: new r.Array(FDRange3, 'nRanges'),
    sentinel: r.uint16
  },

  4: {
    nRanges: r.uint32,
    ranges: new r.Array(FDRange4, 'nRanges'),
    sentinel: r.uint32
  }
});

let ptr = new CFFPointer(CFFPrivateDict);
class CFFPrivateOp {
  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @param {number[]} operands
   * @returns {unknown}
   */
  decode(stream, parent, operands) {
    parent.length = operands[0];
    return ptr.decode(stream, parent, [operands[1]]);
  }

  /**
   * Size operands match encode(null, …): [privateDictByteLength, pointerOperand].
   * @param {StructValue} dict
   * @param {CFFEncodeContext | StructValue} ctx
   * @returns {unknown[]}
   */
  size(dict, ctx) {
    // Delegate to encode(null) so pointerSize is updated and operands match.
    return this.encode(null, dict, ctx);
  }

  /**
   * @param {EncodeStream | null} stream
   * @param {StructValue} dict
   * @param {CFFEncodeContext | StructValue} ctx
   * @returns {unknown[]}
   */
  encode(stream, dict, ctx) {
    return [CFFPrivateDict.size(dict, ctx, false), ptr.encode(stream, dict, ctx)[0]];
  }
}

let FontDict = new CFFDict([
  // key       name                   type(s)                                 default
  [18, 'Private', new CFFPrivateOp(), null],
  [[12, 38], 'FontName', 'sid', null],
  [[12, 7], 'FontMatrix', 'array', [0.001, 0, 0, 0.001, 0, 0]],
  [[12, 5], 'PaintType', 'number', 0]
]);

let CFFTopDict = new CFFDict([
  // key       name                   type(s)                                 default
  [[12, 30], 'ROS', ['sid', 'sid', 'number'], null],

  [0, 'version', 'sid', null],
  [1, 'Notice', 'sid', null],
  [[12, 0], 'Copyright', 'sid', null],
  [2, 'FullName', 'sid', null],
  [3, 'FamilyName', 'sid', null],
  [4, 'Weight', 'sid', null],
  [[12, 1], 'isFixedPitch', 'boolean', false],
  [[12, 2], 'ItalicAngle', 'number', 0],
  [[12, 3], 'UnderlinePosition', 'number', -100],
  [[12, 4], 'UnderlineThickness', 'number', 50],
  [[12, 5], 'PaintType', 'number', 0],
  [[12, 6], 'CharstringType', 'number', 2],
  [[12, 7], 'FontMatrix', 'array', [0.001, 0, 0, 0.001, 0, 0]],
  [13, 'UniqueID', 'number', null],
  [5, 'FontBBox', 'array', [0, 0, 0, 0]],
  [[12, 8], 'StrokeWidth', 'number', 0],
  [14, 'XUID', 'array', null],
  [15, 'charset', CFFCharset, ISOAdobeCharset],
  [16, 'Encoding', CFFEncoding, StandardEncoding],
  [17, 'CharStrings', new CFFPointer(new CFFIndex()), null],
  [18, 'Private', new CFFPrivateOp(), null],
  [[12, 20], 'SyntheticBase', 'number', null],
  [[12, 21], 'PostScript', 'sid', null],
  [[12, 22], 'BaseFontName', 'sid', null],
  [[12, 23], 'BaseFontBlend', 'delta', null],

  // CID font specific
  [[12, 31], 'CIDFontVersion', 'number', 0],
  [[12, 32], 'CIDFontRevision', 'number', 0],
  [[12, 33], 'CIDFontType', 'number', 0],
  [[12, 34], 'CIDCount', 'number', 8720],
  [[12, 35], 'UIDBase', 'number', null],
  [[12, 37], 'FDSelect', new CFFPointer(FDSelect), null],
  [[12, 36], 'FDArray', new CFFPointer(new CFFIndex(FontDict)), null],
  [[12, 38], 'FontName', 'sid', null]
]);

let VariationStore = new r.Struct({
  length: r.uint16,
  itemVariationStore: ItemVariationStore
});

let CFF2TopDict = new CFFDict([
  [[12, 7], 'FontMatrix', 'array', [0.001, 0, 0, 0.001, 0, 0]],
  [17, 'CharStrings', new CFFPointer(new CFFIndex()), null],
  [[12, 37], 'FDSelect', new CFFPointer(FDSelect), null],
  [[12, 36], 'FDArray', new CFFPointer(new CFFIndex(FontDict)), null],
  [24, 'vstore', new CFFPointer(VariationStore), null],
  [25, 'maxstack', 'number', 193]
]);

let CFFTop = new r.VersionedStruct(r.fixed16, {
  1: {
    hdrSize: r.uint8,
    offSize: r.uint8,
    nameIndex: new CFFIndex(new r.String('length')),
    topDictIndex: new CFFIndex(CFFTopDict),
    stringIndex: new CFFIndex(new r.String('length')),
    globalSubrIndex: new CFFIndex()
  },

  2: {
    hdrSize: r.uint8,
    length: r.uint16,
    topDict: CFF2TopDict,
    globalSubrIndex: new CFFIndex()
  }
});

export default CFFTop;

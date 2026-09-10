import * as r from 'restructure';
import { resolveLength } from 'restructure';
import { ItemVariationStore } from './variations';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').LengthSpec} LengthSpec */
/** @typedef {import('restructure').StructValue} StructValue */

/**
 * Integer whose byte width is computed from a LengthSpec.
 * @implements {BaseType}
 */
class VariableSizeNumber {
  /**
   * @param {LengthSpec} size
   */
  constructor(size) {
    /** @type {LengthSpec} */
    this._size = size;
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   * @returns {number}
   */
  decode(stream, parent) {
    switch (this.size(0, parent)) {
      case 1: return stream.readUInt8();
      case 2: return stream.readUInt16BE();
      case 3: return stream.readUInt24BE();
      case 4: return stream.readUInt32BE();
      default: throw new Error(`Unsupported VariableSizeNumber width`);
    }
  }

  /**
   * @param {unknown} _val
   * @param {StructValue | null | undefined} [parent]
   * @returns {number}
   */
  size(_val, parent) {
    return resolveLength(this._size, null, parent);
  }
}

let MapDataEntry = new r.Struct({
  entry: new VariableSizeNumber(
    /** @param {StructValue} t @returns {number} */
    (t) => {
      let parent = /** @type {StructValue} */ (t.parent);
      return ((/** @type {number} */ (parent.entryFormat) & 0x0030) >> 4) + 1;
    }
  ),
  /**
   * @param {StructValue} t
   * @returns {number}
   */
  outerIndex: (t) => {
    let parent = /** @type {StructValue} */ (t.parent);
    let entryFormat = /** @type {number} */ (parent.entryFormat);
    return /** @type {number} */ (t.entry) >> ((entryFormat & 0x000F) + 1);
  },
  /**
   * @param {StructValue} t
   * @returns {number}
   */
  innerIndex: (t) => {
    let parent = /** @type {StructValue} */ (t.parent);
    let entryFormat = /** @type {number} */ (parent.entryFormat);
    return /** @type {number} */ (t.entry) & ((1 << ((entryFormat & 0x000F) + 1)) - 1);
  }
});

let DeltaSetIndexMap = new r.Struct({
  entryFormat: r.uint16,
  mapCount: r.uint16,
  mapData: new r.Array(MapDataEntry, 'mapCount')
});

/** @type {import('restructure').Struct} */
export default new r.Struct({
  majorVersion: r.uint16,
  minorVersion: r.uint16,
  itemVariationStore: new r.Pointer(r.uint32, ItemVariationStore),
  advanceWidthMapping: new r.Pointer(r.uint32, DeltaSetIndexMap),
  LSBMapping: new r.Pointer(r.uint32, DeltaSetIndexMap),
  RSBMapping: new r.Pointer(r.uint32, DeltaSetIndexMap)
});

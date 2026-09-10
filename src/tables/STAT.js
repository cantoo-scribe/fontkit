import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').StructValue} StructValue */

let AxisRecord = new r.Struct({
  axisTag: new r.String(4),
  axisNameID: r.uint16,
  axisOrdering: r.uint16
});

// Formats 1–3 share axisIndex after format; format 4 uses axisCount instead.
let AxisValue = new r.VersionedStruct(r.uint16, {
  1: {
    axisIndex: r.uint16,
    flags: r.uint16,
    valueNameID: r.uint16,
    value: r.fixed32
  },
  2: {
    axisIndex: r.uint16,
    flags: r.uint16,
    valueNameID: r.uint16,
    nominalValue: r.fixed32,
    rangeMinValue: r.fixed32,
    rangeMaxValue: r.fixed32
  },
  3: {
    axisIndex: r.uint16,
    flags: r.uint16,
    valueNameID: r.uint16,
    value: r.fixed32,
    linkedValue: r.fixed32
  },
  4: {
    axisCount: r.uint16,
    flags: r.uint16,
    valueNameID: r.uint16,
    axisValues: new r.Array(new r.Struct({
      axisIndex: r.uint16,
      value: r.fixed32
    }), 'axisCount')
  }
});

let AxisValueArray = new r.Struct({
  axisValues: new r.Array(
    new r.Pointer(r.uint16, AxisValue),
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (/** @type {StructValue} */ (t.parent).axisValueCount)
  )
});

/**
 * Design-axis array whose record stride is designAxisSize (OpenType forward-compat).
 * @implements {BaseType}
 */
class DesignAxisArray {
  /**
   * @param {StructValue | null | undefined} parent
   * @returns {number}
   */
  _stride(parent) {
    // Spec requires room for Tag + 2×uint16 (8 bytes); never shrink below that.
    let fromParent = parent ? /** @type {number | undefined} */ (parent.designAxisSize) : undefined;
    let fromVal = parent && parent.val
      ? /** @type {number | undefined} */ (/** @type {StructValue} */ (parent.val).designAxisSize)
      : undefined;
    return Math.max(8, fromParent ?? fromVal ?? 8);
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   * @returns {StructValue[]}
   */
  decode(stream, parent) {
    let count = parent ? /** @type {number} */ (parent.designAxisCount) : 0;
    let size = this._stride(parent);
    /** @type {StructValue[]} */
    let res = [];
    for (let i = 0; i < count; i++) {
      let start = stream.pos;
      res.push(AxisRecord.decode(stream, parent));
      stream.pos = start + size;
    }
    return res;
  }

  /**
   * @param {unknown} array
   * @param {StructValue | null | undefined} parent
   * @returns {number}
   */
  size(array, parent) {
    let len = Array.isArray(array) ? array.length : 0;
    return len * this._stride(parent);
  }

  /**
   * @param {EncodeStream} stream
   * @param {unknown} array
   * @param {StructValue | null | undefined} parent
   * @returns {void}
   */
  encode(stream, array, parent) {
    let size = this._stride(parent);
    let items = Array.isArray(array) ? /** @type {StructValue[]} */ (array) : [];
    for (let item of items) {
      let start = stream.pos;
      AxisRecord.encode(stream, item, parent);
      let pad = size - (stream.pos - start);
      if (pad > 0) {
        stream.fill(0, pad);
      }
    }
  }
}

/** @type {import('restructure').VersionedStruct} */
export default new r.VersionedStruct(r.uint32, {
  header: {
    designAxisSize: r.uint16,
    designAxisCount: r.uint16,
    offsetToDesignAxes: new r.Pointer(r.uint32, new DesignAxisArray()),
    axisValueCount: r.uint16,
    offsetToAxisValueOffsets: new r.Pointer(r.uint32, AxisValueArray)
  },
  0x00010000: {},
  0x00010001: {
    elidedFallbackNameID: r.uint16
  },
  // v1.2: same header as v1.1; adds AxisValue format 4.
  0x00010002: {
    elidedFallbackNameID: r.uint16
  }
});

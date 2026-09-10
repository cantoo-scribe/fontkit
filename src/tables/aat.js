import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').StructFields} StructFields */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('restructure').VersionedStruct} VersionedStruct */

/**
 * Lazy random-access view over an unbounded run of encoded items.
 */
class UnboundedArrayAccessor {
  /**
   * @param {BaseType} type
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   */
  constructor(type, stream, parent) {
    /** @type {BaseType} */
    this.type = type;
    /** @type {DecodeStream} */
    this.stream = stream;
    /** @type {StructValue | null | undefined} */
    this.parent = parent;
    /** @type {number} */
    this.base = this.stream.pos;
    /** @type {unknown[]} */
    this._items = [];
  }

  /**
   * @param {number} index
   * @returns {unknown}
   */
  getItem(index) {
    if (this._items[index] == null) {
      let pos = this.stream.pos;
      let itemSize = this.type.size?.(null, this.parent);
      this.stream.pos = this.base + /** @type {number} */ (itemSize) * index;
      this._items[index] = this.type.decode?.(this.stream, this.parent);
      this.stream.pos = pos;
    }

    return this._items[index];
  }

  /**
   * @returns {string}
   */
  inspect() {
    let name = this.type.constructor && this.type.constructor.name
      ? this.type.constructor.name
      : 'Type';
    return `[UnboundedArray ${name}]`;
  }
}

/**
 * Array whose length is not stored; consumers index via getItem().
 * @implements {BaseType}
 */
export class UnboundedArray {
  /**
   * @param {BaseType} type
   */
  constructor(type) {
    /** @type {BaseType} */
    this.type = type;
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   * @returns {UnboundedArrayAccessor}
   */
  decode(stream, parent) {
    return new UnboundedArrayAccessor(this.type, stream, parent);
  }
}

/**
 * @param {BaseType} [ValueType]
 * @returns {VersionedStruct}
 */
export function LookupTable(ValueType = r.uint16) {
  /**
   * Re-parents decode/encode so internal lookup structs stay invisible to pointers.
   * @implements {BaseType}
   */
  class Shadow {
    /**
     * @param {BaseType} type
     */
    constructor(type) {
      /** @type {BaseType} */
      this.type = type;
    }

    /**
     * @param {DecodeStream} stream
     * @param {StructValue | null | undefined} ctx
     * @returns {unknown}
     */
    decode(stream, ctx) {
      let parent = ctx && ctx.parent && ctx.parent.parent ? ctx.parent.parent : ctx;
      return this.type.decode?.(stream, parent);
    }

    /**
     * @param {unknown} val
     * @param {StructValue | null | undefined} ctx
     * @returns {number}
     */
    size(val, ctx) {
      let parent = ctx && ctx.parent && ctx.parent.parent ? ctx.parent.parent : ctx;
      return /** @type {number} */ (this.type.size?.(val, parent));
    }

    /**
     * @param {EncodeStream | null} stream
     * @param {unknown} val
     * @param {StructValue | null | undefined} ctx
     * @returns {unknown}
     */
    encode(stream, val, ctx) {
      let parent = ctx && ctx.parent && ctx.parent.parent ? ctx.parent.parent : ctx;
      return this.type.encode?.(stream, val, parent);
    }
  }

  let shadowed = new Shadow(ValueType);

  let BinarySearchHeader = new r.Struct({
    unitSize: r.uint16,
    nUnits: r.uint16,
    searchRange: r.uint16,
    entrySelector: r.uint16,
    rangeShift: r.uint16
  });

  let LookupSegmentSingle = new r.Struct({
    lastGlyph: r.uint16,
    firstGlyph: r.uint16,
    value: shadowed
  });

  let LookupSegmentArray = new r.Struct({
    lastGlyph: r.uint16,
    firstGlyph: r.uint16,
    values: new r.Pointer(
      r.uint16,
      new r.Array(
        shadowed,
        /** @param {StructValue} t @returns {number} */
        t => /** @type {number} */ (t.lastGlyph) - /** @type {number} */ (t.firstGlyph) + 1
      ),
      { type: 'parent' }
    )
  });

  let LookupSingle = new r.Struct({
    glyph: r.uint16,
    value: shadowed
  });

  return new r.VersionedStruct(r.uint16, {
    0: {
      values: new UnboundedArray(shadowed) // length == number of glyphs maybe?
    },
    2: {
      binarySearchHeader: BinarySearchHeader,
      segments: new r.Array(
        LookupSegmentSingle,
        /** @param {StructValue} t @returns {number} */
        t => /** @type {number} */ (/** @type {StructValue} */ (t.binarySearchHeader).nUnits)
      )
    },
    4: {
      binarySearchHeader: BinarySearchHeader,
      segments: new r.Array(
        LookupSegmentArray,
        /** @param {StructValue} t @returns {number} */
        t => /** @type {number} */ (/** @type {StructValue} */ (t.binarySearchHeader).nUnits)
      )
    },
    6: {
      binarySearchHeader: BinarySearchHeader,
      segments: new r.Array(
        LookupSingle,
        /** @param {StructValue} t @returns {number} */
        t => /** @type {number} */ (/** @type {StructValue} */ (t.binarySearchHeader).nUnits)
      )
    },
    8: {
      firstGlyph: r.uint16,
      count: r.uint16,
      values: new r.Array(shadowed, 'count')
    }
  });
}

/**
 * @param {StructFields} [entryData]
 * @param {BaseType} [lookupType]
 * @returns {import('restructure').Struct}
 */
export function StateTable(entryData = {}, lookupType = r.uint16) {
  let entry = Object.assign({
    newState: r.uint16,
    flags: r.uint16
  }, entryData);

  let Entry = new r.Struct(entry);
  let StateArray = new UnboundedArray(
    new r.Array(
      r.uint16,
      /** @param {StructValue} t @returns {number} */
      t => /** @type {number} */ (t.nClasses)
    )
  );

  return new r.Struct({
    nClasses: r.uint32,
    classTable: new r.Pointer(r.uint32, LookupTable(lookupType)),
    stateArray: new r.Pointer(r.uint32, StateArray),
    entryTable: new r.Pointer(r.uint32, new UnboundedArray(Entry))
  });
}

/**
 * Old (16-bit) StateTable structure.
 * @param {StructFields} [entryData]
 * @param {BaseType} [_lookupType]
 * @returns {import('restructure').Struct}
 */
export function StateTable1(entryData = {}, _lookupType = r.uint16) {
  let ClassLookupTable = new r.Struct({
    /** @returns {number} */
    version() { return 8; }, // simulate LookupTable
    firstGlyph: r.uint16,
    values: new r.Array(r.uint8, r.uint16)
  });

  let entry = Object.assign({
    newStateOffset: r.uint16,
    /**
     * Convert offset to stateArray index.
     * @param {StructValue} t
     * @returns {number}
     */
    newState: (t) => {
      /**
       * @typedef {{
       *   stateArray: { base: number },
       *   _startOffset: number,
       *   nClasses: number
       * }} StateParent
       */
      let parent = /** @type {StructValue & StateParent} */ (t.parent);
      return (/** @type {number} */ (t.newStateOffset)
        - (parent.stateArray.base - parent._startOffset)) / parent.nClasses;
    },
    flags: r.uint16
  }, entryData);

  let Entry = new r.Struct(entry);
  let StateArray = new UnboundedArray(
    new r.Array(
      r.uint8,
      /** @param {StructValue} t @returns {number} */
      t => /** @type {number} */ (t.nClasses)
    )
  );

  return new r.Struct({
    nClasses: r.uint16,
    classTable: new r.Pointer(r.uint16, ClassLookupTable),
    stateArray: new r.Pointer(r.uint16, StateArray),
    entryTable: new r.Pointer(r.uint16, new UnboundedArray(Entry))
  });
}

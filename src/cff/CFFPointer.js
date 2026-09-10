import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').PointerOptions} PointerOptions */
/** @typedef {import('restructure').StructValue} StructValue */

/**
 * CFF dict pointer: offset comes from a prior operand rather than the stream.
 * Temporary offsetType stubs only implement the method needed for that phase.
 */
export default class CFFPointer extends r.Pointer {
  /**
   * @param {BaseType | null} type
   * @param {PointerOptions} [options]
   */
  constructor(type, options = {}) {
    if (options.type == null) {
      options.type = 'global';
    }

    super(null, type, options);
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   * @param {number[]} operands
   * @returns {unknown}
   */
  decode(stream, parent, operands) {
    this.offsetType = {
      decode: () => operands[0]
    };

    return super.decode(stream, parent, operands);
  }

  /**
   * @param {EncodeStream | null} stream
   * @param {unknown} value
   * @param {StructValue | null | undefined} ctx
   * @returns {Ptr[]}
   */
  encode(stream, value, ctx) {
    if (!stream) {
      // compute the size (so ctx.pointerSize is correct)
      this.offsetType = {
        size: () => 0
      };

      this.size(value, ctx);
      return [new Ptr(0)];
    }

    /** @type {number | null} */
    let ptr = null;
    this.offsetType = {
      /**
       * @param {EncodeStream} _stream
       * @param {number} val
       */
      encode: (_stream, val) => { ptr = val; }
    };

    super.encode(stream, value, ctx);
    return [new Ptr(ptr ?? 0)];
  }
}

class Ptr {
  /**
   * @param {number} val
   */
  constructor(val) {
    /** @type {number} */
    this.val = val;
    /** @type {boolean} */
    this.forceLarge = true;
  }

  /**
   * @returns {number}
   */
  valueOf() {
    return this.val;
  }
}

import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').NumberT} NumberT */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').CFFCharString} CFFCharString */

export default class CFFIndex {
  /**
   * @param {BaseType} [type]
   */
  constructor(type) {
    /** @type {BaseType | undefined} */
    this.type = type;
  }

  /**
   * @param {StructValue | null | undefined} ctx
   * @returns {number}
   */
  getCFFVersion(ctx) {
    while (ctx && !ctx.hdrSize) {
      ctx = ctx.parent;
    }

    return ctx && typeof ctx.version === 'number' ? ctx.version : -1;
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @returns {unknown[]}
   */
  decode(stream, parent) {
    let version = this.getCFFVersion(parent);
    let count = version >= 2
      ? stream.readUInt32BE()
      : stream.readUInt16BE();

    if (count === 0) {
      return [];
    }

    let offSize = stream.readUInt8();
    /** @type {NumberT} */
    let offsetType;
    if (offSize === 1) {
      offsetType = r.uint8;
    } else if (offSize === 2) {
      offsetType = r.uint16;
    } else if (offSize === 3) {
      offsetType = r.uint24;
    } else if (offSize === 4) {
      offsetType = r.uint32;
    } else {
      throw new Error(`Bad offset size in CFFIndex: ${offSize} ${stream.pos}`);
    }

    /** @type {unknown[]} */
    let ret = [];
    let startPos = stream.pos + ((count + 1) * offSize) - 1;

    let start = offsetType.decode(stream);
    for (let i = 0; i < count; i++) {
      let end = offsetType.decode(stream);

      if (this.type != null && this.type.decode) {
        let pos = stream.pos;
        stream.pos = startPos + start;

        parent.length = end - start;
        ret.push(this.type.decode(stream, parent));
        stream.pos = pos;
      } else {
        /** @type {CFFCharString} */
        let range = {
          offset: startPos + start,
          length: end - start
        };
        ret.push(range);
      }

      start = end;
    }

    stream.pos = startPos + start;
    return ret;
  }

  /**
   * @param {unknown[]} arr
   * @param {StructValue | null | undefined} parent
   * @returns {number}
   */
  size(arr, parent) {
    let size = 2;
    if (arr.length === 0) {
      return size;
    }

    /** @type {BaseType} */
    let type = this.type || new r.Buffer();

    // find maximum offset to detminine offset type
    let offset = 1;
    for (let i = 0; i < arr.length; i++) {
      let item = arr[i];
      if (!type.size) {
        throw new Error('CFFIndex element type must implement size()');
      }
      let itemSize = type.size(item, parent);
      if (typeof itemSize !== 'number') {
        throw new Error('CFFIndex element size() must return a number');
      }
      offset += itemSize;
    }

    /** @type {NumberT} */
    let offsetType;
    if (offset <= 0xff) {
      offsetType = r.uint8;
    } else if (offset <= 0xffff) {
      offsetType = r.uint16;
    } else if (offset <= 0xffffff) {
      offsetType = r.uint24;
    } else if (offset <= 0xffffffff) {
      offsetType = r.uint32;
    } else {
      throw new Error('Bad offset in CFFIndex');
    }

    size += 1 + offsetType.size() * (arr.length + 1);
    size += offset - 1;

    return size;
  }

  /**
   * @param {EncodeStream} stream
   * @param {unknown[]} arr
   * @param {StructValue | null | undefined} parent
   * @returns {void}
   */
  encode(stream, arr, parent) {
    stream.writeUInt16BE(arr.length);
    if (arr.length === 0) {
      return;
    }

    /** @type {BaseType} */
    let type = this.type || new r.Buffer();

    // find maximum offset to detminine offset type
    /** @type {number[]} */
    let sizes = [];
    let offset = 1;
    for (let item of arr) {
      if (!type.size) {
        throw new Error('CFFIndex element type must implement size()');
      }
      let s = type.size(item, parent);
      if (typeof s !== 'number') {
        throw new Error('CFFIndex element size() must return a number');
      }
      sizes.push(s);
      offset += s;
    }

    /** @type {NumberT} */
    let offsetType;
    if (offset <= 0xff) {
      offsetType = r.uint8;
    } else if (offset <= 0xffff) {
      offsetType = r.uint16;
    } else if (offset <= 0xffffff) {
      offsetType = r.uint24;
    } else if (offset <= 0xffffffff) {
      offsetType = r.uint32;
    } else {
      throw new Error('Bad offset in CFFIndex');
    }

    // write offset size
    stream.writeUInt8(offsetType.size());

    // write elements
    offset = 1;
    offsetType.encode(stream, offset);

    for (let size of sizes) {
      offset += size;
      offsetType.encode(stream, offset);
    }

    for (let item of arr) {
      if (!type.encode) {
        throw new Error('CFFIndex element type must implement encode()');
      }
      // Element type varies (String, Buffer, CFFDict, …); BaseType.encode accepts unknown.
      type.encode(stream, item, parent);
    }

    return;
  }
}

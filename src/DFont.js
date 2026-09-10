import * as r from 'restructure';
import TTFFont from './TTFFont';

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('../types/fontkit').NameString} NameString */

/**
 * @param {NameString | null | undefined} a
 * @param {string | Uint8Array} b
 * @returns {boolean}
 */
function postscriptNamesEqual(a, b) {
  if (a === b) {
    return true;
  }
  if (a instanceof Uint8Array && b instanceof Uint8Array) {
    return a.length === b.length && a.every((v, i) => b[i] === v);
  }
  return false;
}

/**
 * @typedef {StructValue & {
 *   id: number,
 *   nameOffset: number,
 *   attr: number,
 *   dataOffset: number,
 *   handle: number,
 *   name?: string | null
 * }} DFontRef
 */

/**
 * @typedef {StructValue & {
 *   name: string,
 *   maxTypeIndex: number,
 *   refList: DFontRef[]
 * }} DFontType
 */

/**
 * @typedef {StructValue & {
 *   length: number,
 *   types: DFontType[]
 * }} DFontTypeList
 */

/**
 * @typedef {StructValue & {
 *   typeList: DFontTypeList,
 *   nameListOffset: number
 * }} DFontMap
 */

/**
 * @typedef {StructValue & {
 *   dataOffset: number,
 *   map: DFontMap,
 *   dataLength: number,
 *   mapLength: number
 * }} DFontHeaderValue
 */

let DFontName = new r.String(r.uint8);

let Ref = new r.Struct({
  id: r.uint16,
  nameOffset: r.int16,
  attr: r.uint8,
  dataOffset: r.uint24,
  handle: r.uint32
});

let Type = new r.Struct({
  name: new r.String(4),
  maxTypeIndex: r.uint16,
  refList: new r.Pointer(
    r.uint16,
    new r.Array(Ref, t => /** @type {DFontType} */ (t).maxTypeIndex + 1),
    { type: 'parent' }
  )
});

let TypeList = new r.Struct({
  length: r.uint16,
  types: new r.Array(Type, t => /** @type {DFontTypeList} */ (t).length + 1)
});

let DFontMap = new r.Struct({
  reserved: new r.Reserved(r.uint8, 24),
  typeList: new r.Pointer(r.uint16, TypeList),
  nameListOffset: new r.Pointer(r.uint16, 'void')
});

let DFontHeader = new r.Struct({
  dataOffset: r.uint32,
  map: new r.Pointer(r.uint32, DFontMap),
  dataLength: r.uint32,
  mapLength: r.uint32
});

export default class DFont {
  /** @type {string} */
  type = 'DFont';

  /** @type {DecodeStream} */
  stream;
  /** @type {DFontHeaderValue} */
  header;
  /** @type {DFontType | undefined} */
  sfnt;

  /**
   * @param {BinaryBuffer | Uint8Array} buffer
   * @returns {boolean}
   */
  static probe(buffer) {
    let stream = new r.DecodeStream(buffer);

    try {
      var header = /** @type {DFontHeaderValue} */ (
        /** @type {unknown} */ (DFontHeader.decode(stream))
      );
    } catch (e) {
      return false;
    }

    for (let type of header.map.typeList.types) {
      if (type.name === 'sfnt') {
        return true;
      }
    }

    return false;
  }

  /**
   * @param {DecodeStream} stream
   */
  constructor(stream) {
    this.stream = stream;
    this.header = /** @type {DFontHeaderValue} */ (
      /** @type {unknown} */ (DFontHeader.decode(this.stream))
    );

    for (let type of this.header.map.typeList.types) {
      for (let ref of type.refList) {
        if (ref.nameOffset >= 0) {
          this.stream.pos = ref.nameOffset + this.header.map.nameListOffset;
          ref.name = DFontName.decode(this.stream);
        } else {
          ref.name = null;
        }
      }

      if (type.name === 'sfnt') {
        this.sfnt = type;
      }
    }
  }

  /**
   * @param {string | Uint8Array} name
   * @returns {TTFFont | null}
   */
  getFont(name) {
    if (!this.sfnt) {
      return null;
    }

    for (let ref of this.sfnt.refList) {
      let pos = this.header.dataOffset + ref.dataOffset + 4;
      let buf = this.stream.buffer;
      let bytes
        = buf instanceof Uint8Array
          ? buf
          : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      let stream = new r.DecodeStream(bytes.subarray(pos));
      let font = new TTFFont(stream);
      if (postscriptNamesEqual(font.postscriptName, name)) {
        return font;
      }
    }

    return null;
  }

  /**
   * @type {TTFFont[]}
   */
  get fonts() {
    /** @type {TTFFont[]} */
    let fonts = [];
    if (!this.sfnt) {
      return fonts;
    }

    for (let ref of this.sfnt.refList) {
      let pos = this.header.dataOffset + ref.dataOffset + 4;
      let buf = this.stream.buffer;
      let bytes
        = buf instanceof Uint8Array
          ? buf
          : new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
      let stream = new r.DecodeStream(bytes.subarray(pos));
      fonts.push(new TTFFont(stream));
    }

    return fonts;
  }
}

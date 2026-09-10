import * as r from 'restructure';
import TTFFont from './TTFFont';
import { asciiDecoder } from './utils';

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

let TTCHeader = new r.VersionedStruct(r.uint32, {
  0x00010000: {
    numFonts: r.uint32,
    offsets: new r.Array(r.uint32, 'numFonts')
  },
  0x00020000: {
    numFonts: r.uint32,
    offsets: new r.Array(r.uint32, 'numFonts'),
    dsigTag: r.uint32,
    dsigLength: r.uint32,
    dsigOffset: r.uint32
  }
});

/**
 * @typedef {StructValue & { offsets: number[] }} TTCHeaderValue
 */

export default class TrueTypeCollection {
  /** @type {string} */
  type = 'TTC';

  /** @type {DecodeStream} */
  stream;
  /** @type {TTCHeaderValue} */
  header;

  /**
   * @param {ArrayBufferView} buffer
   * @returns {boolean}
   */
  static probe(buffer) {
    let bytes
      = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return asciiDecoder.decode(bytes.subarray(0, 4)) === 'ttcf';
  }

  /**
   * @param {DecodeStream} stream
   */
  constructor(stream) {
    this.stream = stream;
    if (stream.readString(4) !== 'ttcf') {
      throw new Error('Not a TrueType collection');
    }

    this.header = /** @type {TTCHeaderValue} */ (
      /** @type {unknown} */ (TTCHeader.decode(stream))
    );
  }

  /**
   * @param {string | Uint8Array} name
   * @returns {TTFFont | null}
   */
  getFont(name) {
    for (let offset of this.header.offsets) {
      let stream = new r.DecodeStream(this.stream.buffer);
      stream.pos = offset;
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
    for (let offset of this.header.offsets) {
      let stream = new r.DecodeStream(this.stream.buffer);
      stream.pos = offset;
      fonts.push(new TTFFont(stream));
    }

    return fonts;
  }
}

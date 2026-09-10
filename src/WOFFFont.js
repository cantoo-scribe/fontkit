import TTFFont from './TTFFont';
import WOFFDirectory from './tables/WOFFDirectory';
import { unzlibSync } from 'fflate';
import * as r from 'restructure';
import { asciiDecoder } from './utils';

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('../types/fontkit').FontDirectory} FontDirectory */
/** @typedef {import('../types/fontkit').TableEntry} TableEntry */

export default class WOFFFont extends TTFFont {
  /** @type {string} */
  type = 'WOFF';

  /** @type {boolean | undefined} */
  _decompressed;

  /**
   * @param {ArrayBufferView} buffer
   * @returns {boolean}
   */
  static probe(buffer) {
    let bytes
      = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return asciiDecoder.decode(bytes.subarray(0, 4)) === 'wOFF';
  }

  /** @returns {void} */
  _decodeDirectory() {
    this.directory = /** @type {FontDirectory} */ (
      /** @type {unknown} */ (WOFFDirectory.decode(this.stream, { _startOffset: 0 }))
    );
  }

  /**
   * @param {TableEntry} table
   * @returns {unknown}
   */
  _decodeTable(table) {
    this._decompress();
    return super._decodeTable(table);
  }

  // Inflate all tables into one stream so internal offsets (e.g. gvar) stay
  // valid against this.stream — same reason WOFF2Font decompresses up front.
  /** @returns {void} */
  _decompress() {
    if (this._decompressed) {
      return;
    }

    let totalSize = 0;
    /** @type {Array<{ entry: TableEntry, newOffset: number }>} */
    let layout = [];
    let tableMap = this.directory.tables;
    for (let tag in tableMap) {
      let entry = tableMap[tag];
      if (!entry) {
        continue;
      }
      layout.push({ entry, newOffset: totalSize });
      totalSize = (totalSize + entry.length + 3) & ~3;
    }

    let buffer = new Uint8Array(totalSize);
    for (let { entry, newOffset } of layout) {
      this.stream.pos = entry.offset;
      /** @type {BinaryBuffer | Uint8Array} */
      let data;
      let compLength = entry.compLength != null ? entry.compLength : entry.length;
      if (compLength < entry.length) {
        let compressed = this.stream.readBuffer(compLength);
        let compressedBytes
          = compressed instanceof Uint8Array
            ? compressed
            : new Uint8Array(compressed.buffer, compressed.byteOffset, compressed.byteLength);
        data = unzlibSync(compressedBytes, {
          out: new Uint8Array(entry.length)
        });
      } else {
        data = this.stream.readBuffer(entry.length);
      }
      buffer.set(data instanceof Uint8Array ? data : new Uint8Array(data.buffer, data.byteOffset, data.byteLength), newOffset);
      entry.offset = newOffset;
    }

    this._setStream(new r.DecodeStream(buffer));
    this._decompressed = true;
  }
}

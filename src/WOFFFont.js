import TTFFont from './TTFFont';
import WOFFDirectory from './tables/WOFFDirectory';
import { unzlibSync } from 'fflate';
import * as r from 'restructure';
import { asciiDecoder } from './utils';

export default class WOFFFont extends TTFFont {
  type = 'WOFF';

  static probe(buffer) {
    return asciiDecoder.decode(buffer.slice(0, 4)) === 'wOFF';
  }

  _decodeDirectory() {
    this.directory = WOFFDirectory.decode(this.stream, { _startOffset: 0 });
  }

  _decodeTable(table) {
    this._decompress();
    return super._decodeTable(table);
  }

  // Inflate all tables into one stream so internal offsets (e.g. gvar) stay
  // valid against this.stream — same reason WOFF2Font decompresses up front.
  _decompress() {
    if (this._decompressed) {
      return;
    }

    let totalSize = 0;
    let layout = [];
    for (let tag in this.directory.tables) {
      let entry = this.directory.tables[tag];
      layout.push({ entry, newOffset: totalSize });
      totalSize = (totalSize + entry.length + 3) & ~3;
    }

    let buffer = new Uint8Array(totalSize);
    for (let { entry, newOffset } of layout) {
      this.stream.pos = entry.offset;
      let data;
      if (entry.compLength < entry.length) {
        data = unzlibSync(this.stream.readBuffer(entry.compLength), {
          out: new Uint8Array(entry.length)
        });
      } else {
        data = this.stream.readBuffer(entry.length);
      }
      buffer.set(data, newOffset);
      entry.offset = newOffset;
    }

    this.stream = new r.DecodeStream(buffer);
    this._decompressed = true;
  }
}

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

  _getTableStream(tag) {
    let table = this.directory.tables[tag];
    if (table) {
      this.stream.pos = table.offset;

      if (table.compLength < table.length) {
        let buf = unzlibSync(this.stream.readBuffer(table.compLength), {
          out: new Uint8Array(table.length)
        });
        return new r.DecodeStream(buf);
      }

      return this.stream;
    }

    return null;
  }
}

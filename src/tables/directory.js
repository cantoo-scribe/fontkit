import * as r from 'restructure';
import Tables from './';

/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').TableEntry} TableEntry */
/** @typedef {import('../../types/fontkit').TableCodec} TableCodec */

/**
 * @typedef {StructValue & {
 *   tag: string,
 *   numTables: number,
 *   searchRange: number,
 *   entrySelector: number,
 *   rangeShift: number,
 *   tables: TableEntry[] | Record<string, TableEntry>
 * }} DirectoryValue
 */

let TableEntryStruct = new r.Struct({
  tag: new r.String(4),
  checkSum: r.uint32,
  offset: new r.Pointer(r.uint32, 'void', { type: 'global' }),
  length: r.uint32
});

/** @type {import('restructure').Struct} */
let Directory = new r.Struct({
  tag: new r.String(4),
  numTables: r.uint16,
  searchRange: r.uint16,
  entrySelector: r.uint16,
  rangeShift: r.uint16,
  tables: new r.Array(TableEntryStruct, 'numTables')
});

Directory.process = function () {
  let self = /** @type {DirectoryValue} */ (this);
  /** @type {Record<string, TableEntry>} */
  let tables = {};
  for (let table of /** @type {TableEntry[]} */ (self.tables)) {
    tables[table.tag] = table;
  }

  self.tables = tables;
};

Directory.preEncode = function () {
  let self = /** @type {DirectoryValue} */ (this);
  if (!Array.isArray(self.tables)) {
    /** @type {TableEntry[]} */
    let tables = [];
    /** @type {Record<string, TableEntry>} */
    let byTag = self.tables;
    for (let tag of Object.keys(byTag)) {
      let table = byTag[tag];
      if (table) {
        let codec = /** @type {TableCodec | undefined} */ (Tables[tag]);
        if (!codec || typeof codec.size !== 'function') {
          throw new Error(`Missing encoder for table "${tag}"`);
        }
        tables.push({
          tag: tag,
          checkSum: 0,
          offset: /** @type {number} */ (/** @type {unknown} */ (
            new r.VoidPointer(/** @type {import('restructure').BaseType} */ (/** @type {unknown} */ (codec)), table)
          )),
          length: codec.size(table)
        });
      }
    }

    self.tables = tables;
  }

  self.tag = 'true';
  self.numTables = self.tables.length;

  let maxExponentFor2 = Math.floor((Math.log(self.numTables) / Math.LN2));
  let maxPowerOf2 = Math.pow(2, maxExponentFor2);

  self.searchRange = maxPowerOf2 * 16;
  self.entrySelector = Math.log(maxPowerOf2) / Math.LN2;
  self.rangeShift = self.numTables * 16 - self.searchRange;
};

export default Directory;

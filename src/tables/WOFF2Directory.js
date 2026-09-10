import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').TableEntry} TableEntry */

/**
 * WOFF2 variable-length unsigned integer (Base128).
 * @type {BaseType}
 */
const Base128 = {
  /**
   * @param {DecodeStream} stream
   * @returns {number}
   */
  decode(stream) {
    let result = 0;
    let iterable = [0, 1, 2, 3, 4];
    for (let j = 0; j < iterable.length; j++) {
      let code = stream.readUInt8();

      // If any of the top seven bits are set then we're about to overflow.
      if (result & 0xe0000000) {
        throw new Error('Overflow');
      }

      result = (result << 7) | (code & 0x7f);
      if ((code & 0x80) === 0) {
        return result;
      }
    }

    throw new Error('Bad base 128 number');
  }
};

let knownTags = [
  'cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ',
  'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp',
  'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF',
  'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL',
  'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc',
  'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx',
  'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'
];

let WOFF2DirectoryEntry = new r.Struct({
  flags: r.uint8,
  customTag: new r.Optional(
    new r.String(4),
    /** @param {StructValue} t @returns {boolean} */
    t => (/** @type {number} */ (t.flags) & 0x3f) === 0x3f
  ),
  /**
   * @param {StructValue} t
   * @returns {string}
   */
  tag: (t) => {
    let flags = /** @type {number} */ (t.flags);
    return /** @type {string} */ (t.customTag) || knownTags[flags & 0x3f];
  },
  length: Base128,
  /**
   * @param {StructValue} t
   * @returns {number}
   */
  transformVersion: t => (/** @type {number} */ (t.flags) >>> 6) & 0x03,
  /**
   * @param {StructValue} t
   * @returns {boolean}
   */
  transformed: t => (t.tag === 'glyf' || t.tag === 'loca')
    ? t.transformVersion === 0
    : t.transformVersion !== 0,
  transformLength: new r.Optional(
    Base128,
    /** @param {StructValue} t @returns {boolean} */
    t => !!t.transformed
  )
});

/**
 * @typedef {StructValue & {
 *   tables: TableEntry[] | Record<string, TableEntry>
 * }} WOFF2DirectoryValue
 */

/** @type {import('restructure').Struct} */
let WOFF2Directory = new r.Struct({
  tag: new r.String(4), // should be 'wOF2'
  flavor: r.uint32,
  length: r.uint32,
  numTables: r.uint16,
  reserved: new r.Reserved(r.uint16),
  totalSfntSize: r.uint32,
  totalCompressedSize: r.uint32,
  majorVersion: r.uint16,
  minorVersion: r.uint16,
  metaOffset: r.uint32,
  metaLength: r.uint32,
  metaOrigLength: r.uint32,
  privOffset: r.uint32,
  privLength: r.uint32,
  tables: new r.Array(WOFF2DirectoryEntry, 'numTables')
});

WOFF2Directory.process = function () {
  let self = /** @type {WOFF2DirectoryValue} */ (this);
  /** @type {Record<string, TableEntry>} */
  let tables = {};
  let list = /** @type {TableEntry[]} */ (self.tables);
  for (let i = 0; i < list.length; i++) {
    let table = list[i];
    tables[table.tag] = table;
  }

  self.tables = tables;
};

export default WOFF2Directory;

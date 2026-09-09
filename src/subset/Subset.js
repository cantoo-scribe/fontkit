import Tables from '../tables';

// Tables written by TTFSubset.encode; must not be overwritten via includeTable.
const MANAGED_TTF_TABLES = [
  'head', 'hhea', 'loca', 'maxp', 'cvt ', 'prep', 'glyf', 'hmtx', 'fpgm'
];

export default class Subset {
  constructor(font) {
    this.font = font;
    this.glyphs = [];
    this.mapping = {};
    // Extra OT table tags to copy into a TTF subset (e.g. 'OS/2', 'name', 'post').
    this.includedTables = [];

    // always include the missing glyph
    this.includeGlyph(0);
  }

  includeGlyph(glyph) {
    if (typeof glyph === 'object') {
      glyph = glyph.id;
    }

    if (this.mapping[glyph] == null) {
      this.glyphs.push(glyph);
      this.mapping[glyph] = this.glyphs.length - 1;
    }

    return this.mapping[glyph];
  }

  // Copy an OT table into the TTF subset (tag is a 4-byte string, e.g. 'OS/2').
  // Only honored by TTFSubset.encode; CFFSubset overrides this to throw.
  includeTable(tag) {
    if (typeof tag !== 'string' || tag.length !== 4) {
      throw new Error(
        `Invalid OpenType table tag ${JSON.stringify(tag)}: tags must be 4 characters `
        + `(pad with spaces if needed, e.g. "cvt ").`
      );
    }

    if (MANAGED_TTF_TABLES.includes(tag)) {
      throw new Error(
        `Table "${tag}" is already managed by the TrueType subsetter and cannot be included explicitly.`
      );
    }

    if (!this.font.directory.tables[tag]) {
      throw new Error(`Table "${tag}" is not present in this font.`);
    }

    if (!Tables[tag]) {
      throw new Error(`Table "${tag}" cannot be encoded (no encoder registered in fontkit).`);
    }

    if (!this.includedTables.includes(tag)) {
      this.includedTables.push(tag);
    }

    return this;
  }
}

import * as r from 'restructure';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').StructValue} StructValue */

let shortFrac = new r.Fixed(16, 'BE', 14);

/**
 * Offset whose width depends on gvar.flags (Apple short/long format).
 * @implements {BaseType}
 */
class Offset {
  /**
   * @param {DecodeStream} stream
   * @param {StructValue | null | undefined} parent
   * @returns {number}
   */
  static decode(stream, parent) {
    // In short format, offsets are multiplied by 2.
    // This doesn't seem to be documented by Apple, but it
    // is implemented this way in Freetype.
    return parent && parent.flags
      ? stream.readUInt32BE()
      : stream.readUInt16BE() * 2;
  }
}

/** @type {import('restructure').Struct} */
let gvar = new r.Struct({
  version: r.uint16,
  reserved: new r.Reserved(r.uint16),
  axisCount: r.uint16,
  globalCoordCount: r.uint16,
  globalCoords: new r.Pointer(r.uint32, new r.Array(new r.Array(shortFrac, 'axisCount'), 'globalCoordCount')),
  glyphCount: r.uint16,
  flags: r.uint16,
  offsetToData: r.uint32,
  offsets: new r.Array(
    new r.Pointer(
      /** @type {BaseType} */ (Offset),
      'void',
      {
        /** @param {StructValue} ctx @returns {number} */
        relativeTo: ctx => /** @type {number} */ (ctx.offsetToData),
        allowNull: false
      }
    ),
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (t.glyphCount) + 1
  )
});

export default gvar;

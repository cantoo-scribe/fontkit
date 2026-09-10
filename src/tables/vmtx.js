import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

let VmtxEntry = new r.Struct({
  advance: r.uint16, // The advance height of the glyph
  bearing: r.int16 // The top sidebearing of the glyph
});

// Vertical Metrics Table
/** @type {import('restructure').Struct} */
export default new r.Struct({
  metrics: new r.LazyArray(
    VmtxEntry,
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (/** @type {StructValue} */ (/** @type {StructValue} */ (t.parent).vhea).numberOfMetrics)
  ),
  bearings: new r.LazyArray(
    r.int16,
    /** @param {StructValue} t @returns {number} */
    (t) => {
      let parent = /** @type {StructValue} */ (t.parent);
      let maxp = /** @type {StructValue} */ (parent.maxp);
      let vhea = /** @type {StructValue} */ (parent.vhea);
      return /** @type {number} */ (maxp.numGlyphs) - /** @type {number} */ (vhea.numberOfMetrics);
    }
  )
});

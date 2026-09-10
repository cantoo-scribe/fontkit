import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

let HmtxEntry = new r.Struct({
  advance: r.uint16,
  bearing: r.int16
});

/** @type {import('restructure').Struct} */
export default new r.Struct({
  metrics: new r.LazyArray(
    HmtxEntry,
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (/** @type {StructValue} */ (/** @type {StructValue} */ (t.parent).hhea).numberOfMetrics)
  ),
  bearings: new r.LazyArray(
    r.int16,
    /** @param {StructValue} t @returns {number} */
    (t) => {
      let parent = /** @type {StructValue} */ (t.parent);
      let maxp = /** @type {StructValue} */ (parent.maxp);
      let hhea = /** @type {StructValue} */ (parent.hhea);
      return /** @type {number} */ (maxp.numGlyphs) - /** @type {number} */ (hhea.numberOfMetrics);
    }
  )
});

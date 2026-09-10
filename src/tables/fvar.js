import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @param {StructValue} t
 * @param {number} nameID
 * @returns {unknown}
 */
function featureName(t, nameID) {
  let parent = /** @type {StructValue} */ (t.parent);
  let grand = /** @type {StructValue} */ (parent.parent);
  let name = /** @type {StructValue} */ (grand.name);
  let records = /** @type {StructValue} */ (name.records);
  let fontFeatures = /** @type {Record<number, unknown>} */ (records.fontFeatures);
  return fontFeatures[nameID];
}

let Axis = new r.Struct({
  axisTag: new r.String(4),
  minValue: r.fixed32,
  defaultValue: r.fixed32,
  maxValue: r.fixed32,
  flags: r.uint16,
  nameID: r.uint16,
  /** @param {StructValue} t @returns {unknown} */
  name: t => featureName(t, /** @type {number} */ (t.nameID))
});

let Instance = new r.Struct({
  nameID: r.uint16,
  /** @param {StructValue} t @returns {unknown} */
  name: t => featureName(t, /** @type {number} */ (t.nameID)),
  flags: r.uint16,
  coord: new r.Array(
    r.fixed32,
    /** @param {StructValue} t @returns {number} */
    t => /** @type {number} */ (/** @type {StructValue} */ (t.parent).axisCount)
  ),
  postscriptNameID: new r.Optional(
    r.uint16,
    /** @param {StructValue} t @returns {boolean} */
    t => /** @type {number} */ (/** @type {StructValue} */ (t.parent).instanceSize)
      - /** @type {number} */ (t._currentOffset) > 0
  )
});

/** @type {import('restructure').Struct} */
export default new r.Struct({
  version: r.fixed32,
  offsetToData: r.uint16,
  countSizePairs: r.uint16,
  axisCount: r.uint16,
  axisSize: r.uint16,
  instanceCount: r.uint16,
  instanceSize: r.uint16,
  axis: new r.Array(Axis, 'axisCount'),
  instance: new r.Array(Instance, 'instanceCount')
});

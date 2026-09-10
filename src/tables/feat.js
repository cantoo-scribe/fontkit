import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @param {StructValue} t
 * @param {number} depth
 * @param {number} nameIndex
 * @returns {unknown}
 */
function featureNameAt(t, depth, nameIndex) {
  let cur = t;
  for (let i = 0; i < depth; i++) {
    cur = /** @type {StructValue} */ (cur.parent);
  }
  let name = /** @type {StructValue} */ (cur.name);
  let records = /** @type {StructValue} */ (name.records);
  let fontFeatures = /** @type {Record<number, unknown>} */ (records.fontFeatures);
  return fontFeatures[nameIndex];
}

let Setting = new r.Struct({
  setting: r.uint16,
  nameIndex: r.int16,
  /** @param {StructValue} t @returns {unknown} */
  name: t => featureNameAt(t, 3, /** @type {number} */ (t.nameIndex))
});

let FeatureName = new r.Struct({
  feature: r.uint16,
  nSettings: r.uint16,
  settingTable: new r.Pointer(r.uint32, new r.Array(Setting, 'nSettings'), { type: 'parent' }),
  featureFlags: new r.Bitfield(r.uint8, [
    null, null, null, null, null, null,
    'hasDefault', 'exclusive'
  ]),
  defaultSetting: r.uint8,
  nameIndex: r.int16,
  /** @param {StructValue} t @returns {unknown} */
  name: t => featureNameAt(t, 2, /** @type {number} */ (t.nameIndex))
});

/** @type {import('restructure').Struct} */
export default new r.Struct({
  version: r.fixed32,
  featureNameCount: r.uint16,
  reserved1: new r.Reserved(r.uint16),
  reserved2: new r.Reserved(r.uint32),
  featureNames: new r.Array(FeatureName, 'featureNameCount')
});

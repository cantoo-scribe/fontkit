import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

let DeviceRecord = new r.Struct({
  pixelSize: r.uint8,
  maximumWidth: r.uint8,
  widths: new r.Array(
    r.uint8,
    /** @param {StructValue} t @returns {number} */
    (t) => {
      let parent = /** @type {StructValue} */ (t.parent);
      let grand = /** @type {StructValue} */ (parent.parent);
      return /** @type {number} */ (/** @type {StructValue} */ (grand.maxp).numGlyphs);
    }
  )
});

// The Horizontal Device Metrics table stores integer advance widths scaled to particular pixel sizes
/** @type {import('restructure').Struct} */
export default new r.Struct({
  version: r.uint16,
  numRecords: r.int16,
  sizeDeviceRecord: r.int32,
  records: new r.Array(DeviceRecord, 'numRecords')
});

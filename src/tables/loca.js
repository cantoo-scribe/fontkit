import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @typedef {StructValue & {
 *   version: number,
 *   offsets: number[],
 *   _processed?: boolean
 * }} LocaValue
 */

/** @type {import('restructure').VersionedStruct} */
let loca = new r.VersionedStruct('head.indexToLocFormat', {
  0: {
    offsets: new r.Array(r.uint16)
  },
  1: {
    offsets: new r.Array(r.uint32)
  }
});

loca.process = function () {
  let self = /** @type {LocaValue} */ (this);
  if (self.version === 0 && !self._processed) {
    for (let i = 0; i < self.offsets.length; i++) {
      self.offsets[i] <<= 1;
    }
    self._processed = true;
  }
};

loca.preEncode = function () {
  let self = /** @type {LocaValue} */ (this);
  if (self.version === 0 && self._processed !== false) {
    for (let i = 0; i < self.offsets.length; i++) {
      self.offsets[i] >>>= 1;
    }
    self._processed = false;
  }
};

export default loca;

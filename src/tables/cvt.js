import * as r from 'restructure';

// An array of predefined values accessible by instructions
/** @type {import('restructure').Struct} */
export default new r.Struct({
  controlValues: new r.Array(r.int16)
});

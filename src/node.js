import fontkit, { registerFormat } from './base';
import TTFFont from './TTFFont';
import WOFFFont from './WOFFFont';
import WOFF2Font from './WOFF2Font';
import TrueTypeCollection from './TrueTypeCollection';
import DFont from './DFont';
import { open, openSync } from './fs';

// Register font formats
registerFormat(TTFFont);
registerFormat(WOFFFont);
registerFormat(WOFF2Font);
registerFormat(TrueTypeCollection);
registerFormat(DFont);

// Node entry also exposes filesystem helpers on the default export.
fontkit.open = open;
fontkit.openSync = openSync;

export * from './base';
export * from './fs';
export default fontkit;

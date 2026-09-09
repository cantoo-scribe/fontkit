import Glyph from './Glyph';

/**
 * Bitmap glyph in CBDT/CBLC format (e.g. color emoji). No vector outline;
 * metrics come from hmtx via Glyph._getMetrics().
 */
export default class CBDTGlyph extends Glyph {
  type = 'CBDT';
}

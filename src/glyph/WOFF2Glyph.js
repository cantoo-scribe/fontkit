import TTFGlyph, { Point } from './TTFGlyph';
import BBox from './BBox';

/** @typedef {import('../../types/fontkit').DecodedGlyf} DecodedGlyf */
/** @typedef {import('../../types/fontkit').GlyphComponent} GlyphComponent */

/**
 * Represents a TrueType glyph in the WOFF2 format, which compresses glyphs differently.
 */
export default class WOFF2Glyph extends TTFGlyph {
  type = 'WOFF2';

  /**
   * @returns {DecodedGlyf | null}
   */
  _decode() {
    let cached = this._font._transformedGlyphs?.[this.id];
    if (!cached) {
      return null;
    }

    if (!this._font._variationProcessor) {
      // Non-variable path: return the pre-decoded glyph without copying.
      return /** @type {DecodedGlyf} */ (cached);
    }

    // Clone so per-instance deltas do not mutate the shared transformed cache.
    // Transformed glyf has no per-glyph bbox; zeros keep phantom-point math
    // aligned with hmtx (same approach as a missing bbox bitmap entry).
    /** @type {DecodedGlyf} */
    let glyph = {
      numberOfContours: cached.numberOfContours,
      xMin: 0,
      yMin: 0,
      xMax: 0,
      yMax: 0
    };

    if (cached.points) {
      glyph.points = cached.points.map((p) => {
        if (typeof p.copy === 'function') {
          return p.copy();
        }
        return new Point(p.onCurve, p.endContour, p.x, p.y);
      });
      let points = glyph.points.concat(this._getPhantomPoints(glyph));
      this._font._variationProcessor.transformPoints(this.id, points);
      glyph.phantomPoints = points.slice(-4);
    }

    if (cached.components) {
      glyph.components = cached.components.map((c) => {
        /** @type {GlyphComponent} */
        let clone = Object.assign(Object.create(Object.getPrototypeOf(c)), c);
        return clone;
      });

      /** @type {Point[]} */
      let points = [];
      for (let component of glyph.components) {
        points.push(new Point(true, true, component.dx, component.dy));
      }
      points.push(...this._getPhantomPoints(glyph));

      this._font._variationProcessor.transformPoints(this.id, points);
      glyph.phantomPoints = points.splice(-4, 4);

      for (let i = 0; i < points.length; i++) {
        glyph.components[i].dx = points[i].x;
        glyph.components[i].dy = points[i].y;
      }
    }

    return glyph;
  }

  /**
   * @param {boolean} [internal]
   * @returns {BBox}
   */
  _getCBox(internal) {
    // Avoid path recursion while building phantom points during variation decode.
    if (internal) {
      return new BBox(0, 0, 0, 0);
    }

    return this.path.bbox;
  }
}

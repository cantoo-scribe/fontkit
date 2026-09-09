import TTFGlyph, { Point } from './TTFGlyph';
import BBox from './BBox';

/**
 * Represents a TrueType glyph in the WOFF2 format, which compresses glyphs differently.
 */
export default class WOFF2Glyph extends TTFGlyph {
  type = 'WOFF2';

  _decode() {
    let cached = this._font._transformedGlyphs[this.id];
    if (!cached) {
      return null;
    }

    if (!this._font._variationProcessor) {
      // Non-variable path: return the pre-decoded glyph without copying.
      return cached;
    }

    // Clone so per-instance deltas do not mutate the shared transformed cache.
    // Transformed glyf has no per-glyph bbox; zeros keep phantom-point math
    // aligned with hmtx (same approach as a missing bbox bitmap entry).
    let glyph = {
      numberOfContours: cached.numberOfContours,
      xMin: 0,
      yMin: 0,
      xMax: 0,
      yMax: 0
    };

    if (cached.points) {
      glyph.points = cached.points.map(p => p.copy());
      let points = glyph.points.concat(this._getPhantomPoints(glyph));
      this._font._variationProcessor.transformPoints(this.id, points);
      glyph.phantomPoints = points.slice(-4);
    }

    if (cached.components) {
      glyph.components = cached.components.map((c) => {
        return Object.assign(Object.create(Object.getPrototypeOf(c)), c);
      });

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

  _getCBox(internal) {
    // Avoid path recursion while building phantom points during variation decode.
    if (internal) {
      return new BBox(0, 0, 0, 0);
    }

    return this.path.bbox;
  }
}

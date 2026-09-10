import { cache } from '../decorators';
import Path from './Path';
import { isMark } from '../packages/unicode-properties/index.js';
import StandardNames from './StandardNames';

/** @typedef {import('../../types/fontkit').FontLike} FontLike */
/** @typedef {import('../../types/fontkit').GlyphMetrics} GlyphMetrics */
/** @typedef {import('../../types/fontkit').MetricsTable} MetricsTable */
/** @typedef {import('../../types/fontkit').PathRenderingContext} PathRenderingContext */
/** @typedef {import('./BBox').default} BBox */

/**
 * Glyph objects represent a glyph in the font. They have various properties for accessing metrics and
 * the actual vector path the glyph represents, and methods for rendering the glyph to a graphics context.
 *
 * You do not create glyph objects directly. They are created by various methods on the font object.
 * There are several subclasses of the base Glyph class internally that may be returned depending
 * on the font format, but they all inherit from this class.
 */
export default class Glyph {
  /**
   * @param {number} id
   * @param {number[]} codePoints
   * @param {FontLike} font
   */
  constructor(id, codePoints, font) {
    /**
     * The glyph id in the font
     * @type {number}
     */
    this.id = id;

    /**
     * An array of unicode code points that are represented by this glyph.
     * There can be multiple code points in the case of ligatures and other glyphs
     * that represent multiple visual characters.
     * @type {number[]}
     */
    this.codePoints = codePoints;

    /** @type {FontLike} */
    this._font = font;

    /** @type {GlyphMetrics | undefined} */
    this._metrics = undefined;

    // TODO: get this info from GDEF if available
    this.isMark = this.codePoints.length > 0 && this.codePoints.every(isMark);
    this.isLigature = this.codePoints.length > 1;
  }

  /**
   * @returns {Path}
   */
  _getPath() {
    return new Path();
  }

  /**
   * @returns {BBox}
   */
  _getCBox() {
    return this.path.cbox;
  }

  /**
   * @returns {BBox}
   */
  _getBBox() {
    return this.path.bbox;
  }

  /**
   * @param {MetricsTable} table
   * @returns {{ advance: number, bearing: number }}
   */
  _getTableMetrics(table) {
    if (this.id < table.metrics.length) {
      let metric = table.metrics.get(this.id);
      return {
        advance: metric ? metric.advance : 0,
        bearing: metric ? metric.bearing : 0
      };
    }

    let metric = table.metrics.get(table.metrics.length - 1);
    let res = {
      advance: metric ? metric.advance : 0,
      bearing: table.bearings.get(this.id - table.metrics.length) || 0
    };

    return res;
  }

  /**
   * @param {BBox} [cbox]
   * @returns {GlyphMetrics}
   */
  _getMetrics(cbox) {
    if (this._metrics) { return this._metrics; }
    if (cbox == null) { ({ cbox } = this); }

    let { advance: advanceWidth, bearing: leftBearing } = this._getTableMetrics(this._font.hmtx);

    // Vertical metrics: vmtx, else font ascent/descent (respects useTypoMetrics)
    let advanceHeight, topBearing;
    if (this._font.vmtx) {
      ({ advance: advanceHeight, bearing: topBearing } = this._getTableMetrics(this._font.vmtx));
    } else {
      advanceHeight = Math.abs(this._font.ascent - this._font.descent);
      topBearing = this._font.ascent - cbox.maxY;
    }

    if (this._font._variationProcessor && this._font.HVAR) {
      advanceWidth += this._font._variationProcessor.getAdvanceAdjustment(this.id, this._font.HVAR);
    }

    let { width, height } = cbox;
    return this._metrics = {
      width,
      height,
      advanceWidth,
      advanceHeight,
      leftBearing,
      topBearing,
      rightBearing: advanceWidth - leftBearing - width,
      bottomBearing: advanceHeight - topBearing - height
    };
  }

  /**
   * The glyph’s control box.
   * This is often the same as the bounding box, but is faster to compute.
   * Because of the way bezier curves are defined, some of the control points
   * can be outside of the bounding box. Where `bbox` takes this into account,
   * `cbox` does not. Thus, cbox is less accurate, but faster to compute.
   * See [here](http://www.freetype.org/freetype2/docs/glyphs/glyphs-6.html#section-2)
   * for a more detailed description.
   *
   * @type {BBox}
   */
  @cache
  get cbox() {
    return this._getCBox();
  }

  /**
   * The glyph’s bounding box, i.e. the rectangle that encloses the
   * glyph outline as tightly as possible.
   * @type {BBox}
   */
  @cache
  get bbox() {
    return this._getBBox();
  }

  /**
   * A vector Path object representing the glyph outline.
   * @type {Path}
   */
  @cache
  get path() {
    // Cache the path so we only decode it once
    // Decoding is actually performed by subclasses
    return this._getPath();
  }

  /**
   * Returns a path scaled to the given font size.
   * @param {number} size
   * @return {Path}
   */
  getScaledPath(size) {
    let scale = 1 / this._font.unitsPerEm * size;
    return this.path.scale(scale);
  }

  /**
   * The glyph's width.
   * @type {number}
   */
  @cache
  get width() {
    return this._getMetrics().width;
  }

  /**
   * The glyph's height.
   * @type {number}
   */
  @cache
  get height() {
    return this._getMetrics().height;
  }

  /**
   * The glyph's advance width.
   * @type {number}
   */
  @cache
  get advanceWidth() {
    return this._getMetrics().advanceWidth;
  }

  /**
   * The glyph's advance height.
   * @type {number}
   */
  @cache
  get advanceHeight() {
    return this._getMetrics().advanceHeight;
  }

  /**
   * The glyph's left side bearing.
   * @type {number}
   */
  @cache
  get leftBearing() {
    return this._getMetrics().leftBearing;
  }

  /**
   * The glyph's top side bearing.
   * @type {number}
   */
  @cache
  get topBearing() {
    return this._getMetrics().topBearing;
  }

  /**
   * The glyph's right side bearing.
   * @type {number}
   */
  @cache
  get rightBearing() {
    return this._getMetrics().rightBearing;
  }

  /**
   * The glyph's bottom side bearing.
   * @type {number}
   */
  @cache
  get bottomBearing() {
    return this._getMetrics().bottomBearing;
  }

  /**
   * @returns {null}
   */
  get ligatureCaretPositions() {
    return null;
  }

  /**
   * @returns {string | null | undefined}
   */
  _getName() {
    let { post } = this._font;
    if (!post) {
      return null;
    }

    switch (post.version) {
      case 1:
        return StandardNames[this.id];

      case 2: {
        let id = post.glyphNameIndex?.[this.id];
        if (id == null) {
          return null;
        }
        if (id < StandardNames.length) {
          return StandardNames[id];
        }

        return post.names?.[id - StandardNames.length];
      }

      case 2.5: {
        let offset = post.offsets?.[this.id];
        if (offset == null) {
          return null;
        }
        return StandardNames[this.id + offset];
      }

      case 4: {
        let mapped = post.map?.[this.id];
        if (mapped == null) {
          return null;
        }
        return String.fromCharCode(mapped);
      }
    }

    return null;
  }

  /**
   * The glyph's name
   * @type {string | null | undefined}
   */
  @cache
  get name() {
    return this._getName();
  }

  /**
   * Renders the glyph to the given graphics context, at the specified font size.
   * @param {PathRenderingContext} ctx
   * @param {number} size
   * @returns {void}
   */
  render(ctx, size) {
    ctx.save();

    let scale = 1 / this._font.head.unitsPerEm * size;
    ctx.scale(scale, scale);

    let fn = this.path.toFunction();
    fn(ctx);
    ctx.fill();

    ctx.restore();
  }
}

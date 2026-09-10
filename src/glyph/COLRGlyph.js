import Glyph from './Glyph';
import BBox from './BBox';

/** @typedef {import('../../types/fontkit').CPALColor} CPALColor */
/** @typedef {import('../../types/fontkit').GlyphLike} GlyphLike */
/** @typedef {import('../../types/fontkit').PathRenderingContext} PathRenderingContext */

class COLRLayer {
  /**
   * @param {GlyphLike | null | undefined} glyph
   * @param {CPALColor} color
   */
  constructor(glyph, color) {
    /** @type {GlyphLike | null | undefined} */
    this.glyph = glyph;
    /** @type {CPALColor} */
    this.color = color;
  }
}

/**
 * Represents a color (e.g. emoji) glyph in Microsoft's COLR format.
 * Each glyph in this format contain a list of colored layers, each
 * of which  is another vector glyph.
 */
export default class COLRGlyph extends Glyph {
  type = 'COLR';

  /**
   * @returns {BBox}
   */
  _getBBox() {
    let layers = this.layers;
    if (!layers) {
      let g = this._font._getBaseGlyph(this.id);
      return g ? new BBox(g.bbox.minX, g.bbox.minY, g.bbox.maxX, g.bbox.maxY) : new BBox(0, 0, 0, 0);
    }

    let bbox = new BBox();
    for (let i = 0; i < layers.length; i++) {
      let layer = layers[i];
      if (!layer.glyph) {
        continue;
      }
      let b = layer.glyph.bbox;
      bbox.addPoint(b.minX, b.minY);
      bbox.addPoint(b.maxX, b.maxY);
    }

    return bbox;
  }

  /**
   * Returns an array of objects containing the glyph and color for
   * each layer in the composite color glyph.
   * @type {COLRLayer[] | null}
   */
  get layers() {
    let cpal = this._font.CPAL;
    let colr = this._font.COLR;

    // COLR v1 uses paint-based records instead of v0 baseGlyphRecord
    if (!colr || !colr.baseGlyphRecord) {
      return null;
    }

    let low = 0;
    let high = colr.baseGlyphRecord.length - 1;
    /** @type {import('../../types/fontkit').COLRBaseGlyphRecord | undefined} */
    let baseLayer;

    while (low <= high) {
      let mid = (low + high) >> 1;
      let rec = colr.baseGlyphRecord[mid];

      if (this.id < rec.gid) {
        high = mid - 1;
      } else if (this.id > rec.gid) {
        low = mid + 1;
      } else {
        baseLayer = rec;
        break;
      }
    }

    // if base glyph not found in COLR table,
    // default to normal glyph from glyf or CFF
    if (baseLayer == null) {
      let g = this._font._getBaseGlyph(this.id);
      /** @type {CPALColor} */
      let color = {
        red: 0,
        green: 0,
        blue: 0,
        alpha: 255
      };

      return [new COLRLayer(g, color)];
    }

    // otherwise, return an array of all the layers
    /** @type {COLRLayer[]} */
    let layers = [];
    for (let i = baseLayer.firstLayerIndex; i < baseLayer.firstLayerIndex + baseLayer.numLayers; i++) {
      let rec = colr.layerRecords[i];
      if (!cpal || !rec) {
        continue;
      }
      let color = cpal.colorRecords[rec.paletteIndex];
      if (!color) {
        continue;
      }
      let g = this._font._getBaseGlyph(rec.gid);
      layers.push(new COLRLayer(g, color));
    }

    return layers;
  }

  /**
   * @param {PathRenderingContext} ctx
   * @param {number} size
   * @returns {void}
   */
  render(ctx, size) {
    let layers = this.layers;
    if (!layers) {
      return;
    }

    for (let { glyph, color } of layers) {
      if (!glyph) {
        continue;
      }
      if (typeof ctx.fillColor === 'function') {
        ctx.fillColor([color.red, color.green, color.blue], color.alpha / 255 * 100);
      }
      glyph.render(ctx, size);
    }

    return;
  }
}

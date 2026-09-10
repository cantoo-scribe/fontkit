import TTFGlyph from './TTFGlyph';
import * as r from 'restructure';

/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').PathRenderingContext} PathRenderingContext */
/** @typedef {import('../../types/fontkit').SBIXImage} SBIXImageData */

let SBIXImageStruct = new r.Struct({
  originX: r.uint16,
  originY: r.uint16,
  type: new r.String(4),
  data: new r.Buffer((t) => {
    let parent = t.parent;
    let buflen = parent && typeof parent.buflen === 'number' ? parent.buflen : 0;
    let offset = typeof t._currentOffset === 'number' ? t._currentOffset : 0;
    return buflen - offset;
  })
});

/**
 * @param {StructValue} raw
 * @returns {SBIXImageData}
 */
function asSBIXImage(raw) {
  let originX = raw.originX;
  let originY = raw.originY;
  let type = raw.type;
  let data = raw.data;
  if (
    typeof originX !== 'number'
    || typeof originY !== 'number'
    || typeof type !== 'string'
    || !ArrayBuffer.isView(data)
  ) {
    throw new Error('Invalid SBIX image');
  }
  return {
    originX,
    originY,
    type,
    data
  };
}

/**
 * Represents a color (e.g. emoji) glyph in Apple's SBIX format.
 */
export default class SBIXGlyph extends TTFGlyph {
  type = 'SBIX';

  /**
   * Returns an object representing a glyph image at the given point size.
   * The object has a data property with a Buffer containing the actual image data,
   * along with the image type, and origin.
   *
   * @param {number} size
   * @return {SBIXImageData | null}
   */
  getImageForSize(size) {
    let sbix = this._font.sbix;
    if (!sbix || sbix.imageTables.length === 0) {
      return null;
    }

    /** @type {import('../../types/fontkit').SBIXImageTable} */
    let table = sbix.imageTables[0];
    for (let i = 0; i < sbix.imageTables.length; i++) {
      table = sbix.imageTables[i];
      if (table.ppem >= size) { break; }
    }

    let offsets = table.imageOffsets;
    let start = offsets[this.id];
    let end = offsets[this.id + 1];

    if (start === end) {
      return null;
    }

    this._font.stream.pos = start;
    return asSBIXImage(SBIXImageStruct.decode(this._font.stream, { buflen: end - start }));
  }

  /**
   * @param {PathRenderingContext} ctx
   * @param {number} size
   * @returns {void}
   */
  render(ctx, size) {
    let img = this.getImageForSize(size);
    if (img != null) {
      let scale = size / this._font.unitsPerEm;
      if (typeof ctx.image === 'function') {
        ctx.image(img.data, { height: size, x: img.originX, y: (this.bbox.minY - img.originY) * scale });
      }
    }

    let sbix = this._font.sbix;
    if (sbix && sbix.flags.renderOutlines) {
      super.render(ctx, size);
    }
  }
}

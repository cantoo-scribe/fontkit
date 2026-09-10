import { binarySearch } from '../utils';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').KernTable} KernTable */
/** @typedef {import('../../types/fontkit').KernPair} KernPair */
/** @typedef {import('../../types/fontkit').KernFormat0} KernFormat0 */
/** @typedef {import('../../types/fontkit').KernFormat2} KernFormat2 */
/** @typedef {import('../../types/fontkit').KernFormat3} KernFormat3 */
/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').LayoutGlyph} LayoutGlyph */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */

/**
 * @param {unknown} s
 * @returns {s is KernFormat0}
 */
function isKernFormat0(s) {
  return typeof s === 'object' && s !== null && Array.isArray(/** @type {{ pairs?: unknown }} */ (s).pairs);
}

/**
 * @param {unknown} s
 * @returns {s is KernFormat2}
 */
function isKernFormat2(s) {
  return typeof s === 'object' && s !== null
    && 'leftTable' in s && 'rightTable' in s && 'array' in s;
}

/**
 * @param {unknown} s
 * @returns {s is KernFormat3}
 */
function isKernFormat3(s) {
  return typeof s === 'object' && s !== null
    && 'glyphCount' in s && 'kernValue' in s && 'kernIndex' in s;
}

export default class KernProcessor {
  /**
   * @param {LayoutFont} font
   */
  constructor(font) {
    /** @type {KernTable} */
    this.kern = /** @type {KernTable} */ (font.kern);
  }

  /**
   * @param {Array<LayoutGlyph | GlyphInfoLike>} glyphs
   * @param {GlyphPositionLike[]} positions
   */
  process(glyphs, positions) {
    for (let glyphIndex = 0; glyphIndex < glyphs.length - 1; glyphIndex++) {
      let left = glyphs[glyphIndex].id;
      let right = glyphs[glyphIndex + 1].id;
      positions[glyphIndex].xAdvance += this.getKerning(left, right);
    }
  }

  /**
   * @param {number} left
   * @param {number} right
   * @returns {number}
   */
  getKerning(left, right) {
    let res = 0;

    for (let table of this.kern.tables) {
      if (table.coverage.crossStream) {
        continue;
      }

      switch (table.version) {
        case 0:
          if (!table.coverage.horizontal) {
            continue;
          }

          break;
        case 1:
          if (table.coverage.vertical || table.coverage.variation) {
            continue;
          }

          break;
        default:
          throw new Error(`Unsupported kerning table version ${table.version}`);
      }

      let val = 0;
      let s = table.subtable;
      switch (table.format) {
        case 0: {
          if (!isKernFormat0(s)) {
            break;
          }
          let pairIdx = binarySearch(s.pairs, /** @param {KernPair} pair */ (pair) => {
            return (left - pair.left) || (right - pair.right);
          });

          if (pairIdx >= 0) {
            val = s.pairs[pairIdx].value;
          }

          break;
        }

        case 2: {
          if (!isKernFormat2(s)) {
            break;
          }
          let leftOffset = 0;
          let rightOffset = 0;
          if (left >= s.leftTable.firstGlyph && left < s.leftTable.firstGlyph + s.leftTable.nGlyphs) {
            leftOffset = s.leftTable.offsets[left - s.leftTable.firstGlyph];
          } else {
            leftOffset = s.array.off;
          }

          if (right >= s.rightTable.firstGlyph && right < s.rightTable.firstGlyph + s.rightTable.nGlyphs) {
            rightOffset = s.rightTable.offsets[right - s.rightTable.firstGlyph];
          }

          let index = (leftOffset + rightOffset - s.array.off) / 2;
          val = s.array.values.get(index);
          break;
        }

        case 3: {
          if (!isKernFormat3(s)) {
            break;
          }
          if (left >= s.glyphCount || right >= s.glyphCount) {
            return 0;
          }

          val = s.kernValue[s.kernIndex[s.leftClass[left] * s.rightClassCount + s.rightClass[right]]];
          break;
        }

        default:
          throw new Error(`Unsupported kerning sub-table format ${table.format}`);
      }

      // Microsoft supports the override flag, which resets the result
      // Otherwise, the sum of the results from all subtables is returned
      if (table.coverage.override) {
        res = val;
      } else {
        res += val;
      }
    }

    return res;
  }
}

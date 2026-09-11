import { binarySearch } from './utils';
import { getEncoding, getEncodingMapping } from './encodings';
import { defineCached } from './decorators';
import { range } from './utils';

/** @typedef {import('../types/fontkit').CmapTable} CmapTable */
/** @typedef {import('../types/fontkit').CmapSubtable} CmapSubtable */
/** @typedef {import('../types/fontkit').CmapSubtable14} CmapSubtable14 */
/** @typedef {import('../types/fontkit').CmapGroup} CmapGroup */
/** @typedef {import('../types/fontkit').CmapVarSelector} CmapVarSelector */

export default class CmapProcessor {
  /**
   * @param {CmapTable} cmapTable
   */
  constructor(cmapTable) {
    // Attempt to find a Unicode cmap first
    /** @type {Map<number, number> | null} */
    this.encoding = null;
    this.cmap = this.findSubtable(cmapTable, [
      // 32-bit subtables
      [3, 10],
      [0, 6],
      [0, 4],

      // 16-bit subtables
      [3, 1],
      [0, 3],
      [0, 2],
      [0, 1],
      [0, 0]
    ]);

    // If not unicode cmap was found, take the first table with a supported encoding.
    if (!this.cmap) {
      for (let cmap of cmapTable.tables) {
        let language
          = 'language' in cmap.table && typeof cmap.table.language === 'number'
            ? cmap.table.language - 1
            : 0;
        let encoding = getEncoding(cmap.platformID, cmap.encodingID, language);
        if (!encoding) {
          continue;
        }
        let mapping = getEncodingMapping(encoding);
        if (mapping) {
          this.cmap = cmap.table;
          this.encoding = mapping;
        }
      }
    }

    if (!this.cmap) {
      throw new Error('Could not find a supported cmap table');
    }

    let uvs = this.findSubtable(cmapTable, [[0, 5]]);
    /** @type {CmapSubtable14 | null} */
    this.uvs = uvs && uvs.version === 14 ? /** @type {CmapSubtable14} */ (uvs) : null;
  }

  /**
   * @param {CmapTable} cmapTable
   * @param {Array<[number, number]>} pairs
   * @returns {CmapSubtable | null}
   */
  findSubtable(cmapTable, pairs) {
    for (let [platformID, encodingID] of pairs) {
      for (let cmap of cmapTable.tables) {
        if (cmap.platformID === platformID && cmap.encodingID === encodingID) {
          return cmap.table;
        }
      }
    }

    return null;
  }

  /**
   * @param {number} codepoint
   * @param {number} [variationSelector]
   * @returns {number}
   */
  lookup(codepoint, variationSelector) {
    // If there is no Unicode cmap in this font, we need to re-encode
    // the codepoint in the encoding that the cmap supports.
    if (this.encoding) {
      codepoint = this.encoding.get(codepoint) || codepoint;

      // Otherwise, try to get a Unicode variation selector for this codepoint if one is provided.
    } else if (variationSelector) {
      let gid = this.getVariationSelector(codepoint, variationSelector);
      if (gid) {
        return gid;
      }
    }

    let cmap = this.cmap;
    switch (cmap.version) {
      case 0:
        return cmap.codeMap.get(codepoint) || 0;

      case 4: {
        let min = 0;
        let max = cmap.segCount - 1;
        while (min <= max) {
          let mid = (min + max) >> 1;

          if (codepoint < /** @type {number} */ (cmap.startCode.get(mid))) {
            max = mid - 1;
          } else if (codepoint > /** @type {number} */ (cmap.endCode.get(mid))) {
            min = mid + 1;
          } else {
            let rangeOffset = /** @type {number} */ (cmap.idRangeOffset.get(mid));
            let gid;

            if (rangeOffset === 0) {
              gid = codepoint + /** @type {number} */ (cmap.idDelta.get(mid));
            } else {
              let index = rangeOffset / 2 + (codepoint - /** @type {number} */ (cmap.startCode.get(mid))) - (cmap.segCount - mid);
              gid = cmap.glyphIndexArray.get(index) || 0;
              if (gid !== 0) {
                gid += /** @type {number} */ (cmap.idDelta.get(mid));
              }
            }

            return gid & 0xffff;
          }
        }

        return 0;
      }

      case 8:
        throw new Error('TODO: cmap format 8');

      case 6:
      case 10:
        return cmap.glyphIndices.get(codepoint - cmap.firstCode) || 0;

      case 12:
      case 13: {
        let min = 0;
        let max = cmap.nGroups - 1;
        while (min <= max) {
          let mid = (min + max) >> 1;
          let group = /** @type {CmapGroup} */ (cmap.groups.get(mid));

          if (codepoint < group.startCharCode) {
            max = mid - 1;
          } else if (codepoint > group.endCharCode) {
            min = mid + 1;
          } else {
            if (cmap.version === 12) {
              return group.glyphID + (codepoint - group.startCharCode);
            } else {
              return group.glyphID;
            }
          }
        }

        return 0;
      }

      case 14:
        throw new Error('TODO: cmap format 14');

      default:
        throw new Error(`Unknown cmap format ${/** @type {{ version: number }} */ (cmap).version}`);
    }
  }

  /**
   * @param {number} codepoint
   * @param {number} variationSelector
   * @returns {number}
   */
  getVariationSelector(codepoint, variationSelector) {
    if (!this.uvs) {
      return 0;
    }

    let selectors = this.uvs.varSelectors.toArray();
    let i = binarySearch(selectors, x => variationSelector - x.varSelector);
    if (i === -1) {
      return 0;
    }

    let sel = /** @type {CmapVarSelector} */ (selectors[i]);
    let { defaultUVS, nonDefaultUVS } = sel;

    // Default UVS: fall back to the base character's normal cmap glyph.
    if (defaultUVS && binarySearch(defaultUVS, x =>
      codepoint < x.startUnicodeValue ? -1 : codepoint > x.startUnicodeValue + x.additionalCount ? 1 : 0
    ) !== -1) return 0;

    if (!nonDefaultUVS) return 0;

    let ni = binarySearch(nonDefaultUVS, x => codepoint - x.unicodeValue);
    return ni !== -1 ? nonDefaultUVS[ni].glyphID : 0;
  }

  /**
   * @returns {number[]}
   */
  getCharacterSet() {
    let cmap = this.cmap;
    switch (cmap.version) {
      case 0:
        return range(0, cmap.codeMap.length);

      case 4: {
        let res = [];
        let endCodes = cmap.endCode.toArray();
        for (let i = 0; i < endCodes.length; i++) {
          let tail = endCodes[i] + 1;
          let start = /** @type {number} */ (cmap.startCode.get(i));
          res.push(...range(start, tail));
        }

        return res;
      }

      case 8:
        throw new Error('TODO: cmap format 8');

      case 6:
      case 10:
        return range(cmap.firstCode, cmap.firstCode + cmap.glyphIndices.length);

      case 12:
      case 13: {
        let res = [];
        for (let group of cmap.groups.toArray()) {
          res.push(...range(group.startCharCode, group.endCharCode + 1));
        }

        return res;
      }

      case 14:
        throw new Error('TODO: cmap format 14');

      default:
        throw new Error(`Unknown cmap format ${/** @type {{ version: number }} */ (cmap).version}`);
    }
  }

  /**
   * @param {number} gid
   * @returns {number[]}
   */
  codePointsForGlyph(gid) {
    let cmap = this.cmap;
    switch (cmap.version) {
      case 0: {
        let res = [];
        for (let i = 0; i < 256; i++) {
          if (cmap.codeMap.get(i) === gid) {
            res.push(i);
          }
        }

        return res;
      }

      case 4: {
        let res = [];
        for (let i = 0; i < cmap.segCount; i++) {
          let end = /** @type {number} */ (cmap.endCode.get(i));
          let start = /** @type {number} */ (cmap.startCode.get(i));
          let rangeOffset = /** @type {number} */ (cmap.idRangeOffset.get(i));
          let delta = /** @type {number} */ (cmap.idDelta.get(i));

          for (var c = start; c <= end; c++) {
            let g;
            if (rangeOffset === 0) {
              g = c + delta;
            } else {
              let index = rangeOffset / 2 + (c - start) - (cmap.segCount - i);
              g = cmap.glyphIndexArray.get(index) || 0;
              if (g !== 0) {
                g += delta;
              }
            }

            if ((g & 0xffff) === gid) {
              res.push(c);
            }
          }
        }

        return res;
      }

      case 12: {
        let res = [];
        for (let group of cmap.groups.toArray()) {
          if (gid >= group.glyphID && gid <= group.glyphID + (group.endCharCode - group.startCharCode)) {
            res.push(group.startCharCode + (gid - group.glyphID));
          }
        }

        return res;
      }

      case 13: {
        let res = [];
        for (let group of cmap.groups.toArray()) {
          if (gid === group.glyphID) {
            res.push(...range(group.startCharCode, group.endCharCode + 1));
          }
        }

        return res;
      }

      default:
        throw new Error(`Unknown cmap format ${cmap.version}`);
    }
  }
}

defineCached(CmapProcessor.prototype, [
  'getCharacterSet',
  'codePointsForGlyph'
]);

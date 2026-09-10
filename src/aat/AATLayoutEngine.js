import * as AATFeatureMap from './AATFeatureMap';
import AATMorxProcessor from './AATMorxProcessor';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').GlyphRunLike} GlyphRunLike */
/** @typedef {import('../../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../../types/fontkit').LanguageTag} LanguageTag */

export default class AATLayoutEngine {
  /**
   * @param {LayoutFont} font
   */
  constructor(font) {
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {AATMorxProcessor} */
    this.morxProcessor = new AATMorxProcessor(font);
    /** @type {boolean} */
    this.fallbackPosition = false;
  }

  /**
   * @param {GlyphRunLike} glyphRun
   */
  substitute(glyphRun) {
    // AAT expects the glyphs to be in visual order prior to morx processing,
    // so reverse the glyphs if the script is right-to-left.
    if (glyphRun.direction === 'rtl') {
      glyphRun.glyphs.reverse();
    }

    this.morxProcessor.process(
      /** @type {import('../../types/fontkit').LayoutGlyph[]} */ (glyphRun.glyphs),
      AATFeatureMap.mapOTToAAT(glyphRun.features)
    );
  }

  /**
   * @param {ScriptTag | string[] | null | undefined} [_script]
   * @param {LanguageTag | null | undefined} [_language]
   * @returns {string[]}
   */
  getAvailableFeatures(_script, _language) {
    return AATFeatureMap.mapAATToOT(this.morxProcessor.getSupportedFeatures());
  }

  /**
   * @param {number} gid
   * @returns {Set<string>}
   */
  stringsForGlyph(gid) {
    let glyphStrings = this.morxProcessor.generateInputs(gid);
    let result = new Set();

    for (let glyphs of glyphStrings) {
      this._addStrings(glyphs, 0, result, '');
    }

    return result;
  }

  /**
   * @param {number[]} glyphs
   * @param {number} index
   * @param {Set<string>} strings
   * @param {string} string
   */
  _addStrings(glyphs, index, strings, string) {
    let codePoints = this.font._cmapProcessor.codePointsForGlyph(glyphs[index]);

    for (let codePoint of codePoints) {
      let s = string + String.fromCodePoint(codePoint);
      if (index < glyphs.length - 1) {
        this._addStrings(glyphs, index + 1, strings, s);
      } else {
        strings.add(s);
      }
    }
  }
}

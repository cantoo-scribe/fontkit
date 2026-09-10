import { isDigit, isMark } from '../../packages/unicode-properties/index.js';
import GlyphInfo from '../GlyphInfo';

/** @typedef {import('../../../types/fontkit').ShapingPlanLike} ShapingPlanLike */
/** @typedef {import('../../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../../types/fontkit').FeatureInput} FeatureInput */
/** @typedef {import('../../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../../types/fontkit').TextDirection} TextDirection */

const VARIATION_FEATURES = ['rvrn'];
const COMMON_FEATURES = ['ccmp', 'locl', 'rlig', 'mark', 'mkmk'];
const FRACTIONAL_FEATURES = ['frac', 'numr', 'dnom'];
const HORIZONTAL_FEATURES = ['calt', 'clig', 'liga', 'rclt', 'curs', 'kern'];
const _VERTICAL_FEATURES = ['vert'];
/** @type {Record<TextDirection, string[]>} */
const DIRECTIONAL_FEATURES = {
  ltr: ['ltra', 'ltrm'],
  rtl: ['rtla', 'rtlm']
};

export default class DefaultShaper {
  static zeroMarkWidths = 'AFTER_GPOS';

  /**
   * @param {ShapingPlanLike} plan
   * @param {GlyphInfoLike[]} glyphs
   * @param {FeatureInput | null | undefined} features
   */
  static plan(plan, glyphs, features) {
    // Plan the features we want to apply
    this.planPreprocessing(plan);
    this.planFeatures(plan);
    this.planPostprocessing(plan, features);

    // Assign the global features to all the glyphs
    plan.assignGlobalFeatures(glyphs);

    // Assign local features to glyphs
    this.assignFeatures(plan, glyphs);
  }

  /**
   * @param {ShapingPlanLike} plan
   */
  static planPreprocessing(plan) {
    plan.add({
      global: [...VARIATION_FEATURES, ...DIRECTIONAL_FEATURES[plan.direction]],
      local: FRACTIONAL_FEATURES
    });
  }

  /**
   * @param {ShapingPlanLike} _plan
   */
  static planFeatures(_plan) {
    // Do nothing by default. Let subclasses override this.
  }

  /**
   * @param {ShapingPlanLike} plan
   * @param {FeatureInput | null | undefined} userFeatures
   */
  static planPostprocessing(plan, userFeatures) {
    plan.add([...COMMON_FEATURES, ...HORIZONTAL_FEATURES]);
    plan.setFeatureOverrides(userFeatures);
  }

  /**
   * @param {ShapingPlanLike} plan
   * @param {GlyphInfoLike[]} glyphs
   */
  static assignFeatures(plan, glyphs) {
    // Font-aware NFC before GSUB (HarfBuzz default-shaper behavior).
    composeGlyphs(plan.font, glyphs);

    // Enable contextual fractions
    for (let i = 0; i < glyphs.length; i++) {
      let glyph = glyphs[i];
      if (glyph.codePoints[0] === 0x2044) { // fraction slash
        let start = i;
        let end = i + 1;

        // Apply numerator
        while (start > 0 && isDigit(glyphs[start - 1].codePoints[0])) {
          glyphs[start - 1].features.numr = true;
          glyphs[start - 1].features.frac = true;
          start--;
        }

        // Apply denominator
        while (end < glyphs.length && isDigit(glyphs[end].codePoints[0])) {
          glyphs[end].features.dnom = true;
          glyphs[end].features.frac = true;
          end++;
        }

        // Apply fraction slash
        glyph.features.frac = true;
        i = end - 1;
      }
    }
  }
}

/**
 * Compose base+mark clusters when the font has the precomposed glyph.
 * Skip pure mark reorders (same length) so Arabic calt etc. keep expected order.
 * @param {LayoutFont} font
 * @param {GlyphInfoLike[]} glyphs
 */
function composeGlyphs(font, glyphs) {
  /**
   * @param {GlyphInfoLike} g
   * @returns {boolean}
   */
  let singleMark = g => g.codePoints.length === 1 && isMark(g.codePoints[0]);

  for (let i = 0; i < glyphs.length;) {
    let base = glyphs[i];
    if (base.codePoints.length !== 1 || isMark(base.codePoints[0])) {
      i++;
      continue;
    }

    let end = i + 1;
    while (end < glyphs.length && singleMark(glyphs[end])) end++;
    if (end === i + 1) {
      i++;
      continue;
    }

    let input = glyphs.slice(i, end).map(/** @param {GlyphInfoLike} g */ g => g.codePoints[0]);
    let composed = Array.from(String.fromCodePoint(...input).normalize('NFC')).flatMap((char) => {
      let cp = char.codePointAt(0);
      if (cp == null) {
        return /** @type {number[]} */ ([]);
      }
      return font.hasGlyphForCodePoint(cp)
        ? [cp]
        : Array.from(char.normalize('NFD'), c => /** @type {number} */ (c.codePointAt(0)));
    });

    if (composed.length === input.length) {
      i = end;
      continue;
    }

    /** @type {GlyphInfo[]} */
    let replacement = [];
    for (let cp of composed) {
      let g = font.glyphForCodePoint(cp);
      if (g) {
        replacement.push(new GlyphInfo(font, g.id, [cp], /** @type {FeatureMap} */ (base.features)));
      }
    }
    glyphs.splice(i, end - i, ...replacement);
    i += replacement.length;
  }
}

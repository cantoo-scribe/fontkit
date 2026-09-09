import {getCombiningClass} from '../../packages/unicode-properties/index.js';
import DefaultShaper from './DefaultShaper';
import GlyphInfo from '../GlyphInfo';

/**
 * Hebrew shaper (HarfBuzz hb-ot-shaper-hebrew.cc):
 *   - Compose presentation forms (FBxx) when the font lacks GPOS mark for `hebr`
 *   - Reorder patah/qamats + sheva/hiriq + meteg/below so meteg sits next to the base
 */
export default class HebrewShaper extends DefaultShaper {
  static assignFeatures(plan, glyphs) {
    super.assignFeatures(plan, glyphs);

    if (!hasGposMark(plan.font)) {
      composeHebrew(glyphs, plan.font);
    }
    reorderMarksHebrew(glyphs);
  }
}

// Dagesh forms for U+05D0..U+05EA (0 = no precomposed form).
const DAGESH_FORMS = [
  0xFB30, 0xFB31, 0xFB32, 0xFB33, 0xFB34, 0xFB35, 0xFB36, 0,
  0xFB38, 0xFB39, 0xFB3A, 0xFB3B, 0xFB3C, 0, 0xFB3E, 0,
  0xFB40, 0xFB41, 0, 0xFB43, 0xFB44, 0, 0xFB46, 0xFB47,
  0xFB48, 0xFB49, 0xFB4A
];

// Precomposed Hebrew presentation form for `a + b`, or null (HB compose_hebrew).
function composeHebrewPair(a, b) {
  switch (b) {
    case 0x05B4: // HIRIQ
      return a === 0x05D9 ? 0xFB1D : null;
    case 0x05B7: // PATAH
      return a === 0x05F2 ? 0xFB1F : a === 0x05D0 ? 0xFB2E : null;
    case 0x05B8: // QAMATS
      return a === 0x05D0 ? 0xFB2F : null;
    case 0x05B9: // HOLAM
      return a === 0x05D5 ? 0xFB4B : null;
    case 0x05BC: // DAGESH
      if (a >= 0x05D0 && a <= 0x05EA) return DAGESH_FORMS[a - 0x05D0] || null;
      if (a === 0xFB2A) return 0xFB2C;
      if (a === 0xFB2B) return 0xFB2D;
      return null;
    case 0x05BF: // RAFE
      return a === 0x05D1 ? 0xFB4C : a === 0x05DB ? 0xFB4D : a === 0x05E4 ? 0xFB4E : null;
    case 0x05C1: // SHIN DOT
      return a === 0x05E9 ? 0xFB2A : a === 0xFB49 ? 0xFB2C : null;
    case 0x05C2: // SIN DOT
      return a === 0x05E9 ? 0xFB2B : a === 0xFB49 ? 0xFB2D : null;
    default:
      return null;
  }
}

// Greedily compose adjacent pairs when the font has the glyph
// (e.g. SHIN + SHIN_DOT → FB2A, then + DAGESH → FB2C).
function composeHebrew(glyphs, font) {
  for (let i = 0; i + 1 < glyphs.length; ) {
    let composed = glyphs[i].codePoints[0];
    let consumed = 1;
    while (i + consumed < glyphs.length) {
      let ab = composeHebrewPair(composed, glyphs[i + consumed].codePoints[0]);
      if (ab == null || !font.hasGlyphForCodePoint(ab)) break;
      composed = ab;
      consumed++;
    }
    if (consumed > 1) {
      let cps = [];
      for (let j = 0; j < consumed; j++) cps.push(...glyphs[i + j].codePoints);
      glyphs[i] = new GlyphInfo(font, font.glyphForCodePoint(composed).id, cps, glyphs[i].features);
      glyphs.splice(i + 1, consumed - 1);
    }
    i++;
  }
}

// HB reorder_marks_hebrew: [patah/qamats, sheva/hiriq, meteg/below] → swap last two.
// unicode-properties already exposes Hebrew modified CCCs (CCC10/14/17/18/22).
function reorderMarksHebrew(glyphs) {
  for (let i = 2; i < glyphs.length; i++) {
    let c0 = getCombiningClass(glyphs[i - 2].codePoints[0]);
    let c1 = getCombiningClass(glyphs[i - 1].codePoints[0]);
    let c2 = getCombiningClass(glyphs[i].codePoints[0]);
    if (
      (c0 === 'CCC17' || c0 === 'CCC18') &&
      (c1 === 'CCC10' || c1 === 'CCC14') &&
      (c2 === 'CCC22' || c2 === 'Below')
    ) {
      [glyphs[i - 1], glyphs[i]] = [glyphs[i], glyphs[i - 1]];
      break;
    }
  }
}

// Gate fallback composition on Hebrew-script GPOS `mark` (not the global featureList).
function hasGposMark(font) {
  let hebr = font.GPOS?.scriptList?.find(e => e.tag === 'hebr')?.script;
  if (!hebr) return false;

  let langs = [hebr.defaultLangSys, ...(hebr.langSysRecords || []).map(l => l.langSys)].filter(Boolean);
  return langs.some(ls =>
    (ls.featureIndexes || []).some(i => font.GPOS.featureList[i]?.tag === 'mark')
  );
}

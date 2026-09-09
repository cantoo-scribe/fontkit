import DefaultShaper from './DefaultShaper';
import GlyphInfo from '../GlyphInfo';

/**
 * Thai / Lao shaper (HarfBuzz hb-ot-shaper-thai.cc):
 *   1. Decompose SARA AM → NIKHAHIT + SARA AA and reorder NIKHAHIT past above marks
 *   2. PUA tone/vowel shift fallback for legacy fonts without Thai GSUB
 */
export default class ThaiShaper extends DefaultShaper {
  static assignFeatures(plan, glyphs) {
    super.assignFeatures(plan, glyphs);
    preprocessThai(glyphs, plan.font);
    // HB: PUA only when buffer script is Thai and the font has no Thai GSUB.
    if (isThaiBufferScript(plan.bufferScript || plan.script) && !hasThaiGsub(plan.font)) {
      applyThaiPuaShaping(glyphs, plan.font);
    }
  }
}

// Thai/Lao SARA AM differ only by the 0x80 bit (U+0E33 / U+0EB3).
function isSaraAm(u) {
  return (u & ~0x0080) === 0x0E33;
}

function nikhahitFromSaraAm(u) {
  return u - 0x0E33 + 0x0E4D;
}

function saraAaFromSaraAm(u) {
  return u - 1;
}

// Above-base marks (Thai; Lao is the same set with +0x80).
function isAboveBaseMark(u) {
  const c = u & ~0x0080;
  return c === 0x0E31
    || (c >= 0x0E34 && c <= 0x0E37)
    || (c >= 0x0E47 && c <= 0x0E4E)
    || c === 0x0E3B;
}

function preprocessThai(glyphs, font) {
  let i = 0;
  while (i < glyphs.length) {
    const u = glyphs[i].codePoints[0];
    if (!isSaraAm(u)) {
      i++;
      continue;
    }

    const features = glyphs[i].features;
    const nikhahit = makeGlyph(font, nikhahitFromSaraAm(u), features);
    const saraAa = makeGlyph(font, saraAaFromSaraAm(u), features);
    glyphs.splice(i, 1, nikhahit, saraAa);

    // Walk NIKHAHIT backward over above-base marks toward the base.
    let nikhahitIndex = i;
    let target = nikhahitIndex;
    while (target > 0 && isAboveBaseMark(glyphs[target - 1].codePoints[0])) {
      target--;
    }
    if (target !== nikhahitIndex) {
      const moved = glyphs.splice(nikhahitIndex, 1)[0];
      glyphs.splice(target, 0, moved);
    }

    i += 2;
  }
}

function makeGlyph(font, codePoint, features) {
  const id = font.glyphForCodePoint(codePoint).id;
  return new GlyphInfo(font, id, [codePoint], features);
}

// PUA fallback: above/below state machines remap marks (and some bases) to
// Windows/Mac private-use codepoints when the font ships those glyphs.
const NOP = 0;
const SD = 1;
const SL = 2;
const SDL = 3;
const RD = 4;

const NC = 0; // normal consonant
const AC = 1; // ascender (1B/1D/1F)
const RC = 2; // removable descender (0D/10)
const DC = 3; // strict descender (0E/0F)
const NOT_CONSONANT = 4;

const AV = 0; // above-base vowel/mark
const BV = 1; // below-base vowel/mark
const T = 2;  // tone mark
const NOT_MARK = 3;

function getConsonantType(u) {
  if (u === 0x0E1B || u === 0x0E1D || u === 0x0E1F) return AC;
  if (u === 0x0E0D || u === 0x0E10) return RC;
  if (u === 0x0E0E || u === 0x0E0F) return DC;
  if (u >= 0x0E01 && u <= 0x0E2E) return NC;
  return NOT_CONSONANT;
}

function getMarkType(u) {
  if (
    u === 0x0E31 ||
    (u >= 0x0E34 && u <= 0x0E37) ||
    u === 0x0E47 ||
    (u >= 0x0E4D && u <= 0x0E4E)
  ) {
    return AV;
  }
  if (u >= 0x0E38 && u <= 0x0E3A) return BV;
  if (u >= 0x0E48 && u <= 0x0E4C) return T;
  return NOT_MARK;
}

const T0 = 0, T1 = 1, T2 = 2, T3 = 3;
const ABOVE_START_STATE = [T0, T1, T0, T0, T3]; // NC AC RC DC NOT_CONSONANT
const ABOVE_STATE_MACHINE = [
  // AV          BV          T
  [[NOP, T3], [NOP, T0], [SD, T3]],   // T0
  [[SL, T2],  [NOP, T1], [SDL, T2]],  // T1
  [[NOP, T3], [NOP, T2], [SL, T3]],   // T2
  [[NOP, T3], [NOP, T3], [NOP, T3]]   // T3
];

const B0 = 0, B1 = 1, B2 = 2;
const BELOW_START_STATE = [B0, B0, B1, B2, B2];
const BELOW_STATE_MACHINE = [
  // AV          BV          T
  [[NOP, B0], [NOP, B2], [NOP, B0]],  // B0
  [[NOP, B1], [RD, B2],  [NOP, B1]],  // B1
  [[NOP, B2], [SD, B2],  [NOP, B2]]   // B2
];

// [original, Windows PUA, Mac PUA] per action
const PUA_MAPPINGS = {
  [SD]: [
    [0x0E48, 0xF70A, 0xF88B], // MAI EK
    [0x0E49, 0xF70B, 0xF88E], // MAI THO
    [0x0E4A, 0xF70C, 0xF891], // MAI TRI
    [0x0E4B, 0xF70D, 0xF894], // MAI CHATTAWA
    [0x0E4C, 0xF70E, 0xF897], // THANTHAKHAT
    [0x0E38, 0xF718, 0xF89B], // SARA U
    [0x0E39, 0xF719, 0xF89C], // SARA UU
    [0x0E3A, 0xF71A, 0xF89D]  // PHINTHU
  ],
  [SDL]: [
    [0x0E48, 0xF705, 0xF88C],
    [0x0E49, 0xF706, 0xF88F],
    [0x0E4A, 0xF707, 0xF892],
    [0x0E4B, 0xF708, 0xF895],
    [0x0E4C, 0xF709, 0xF898]
  ],
  [SL]: [
    [0x0E48, 0xF713, 0xF88A],
    [0x0E49, 0xF714, 0xF88D],
    [0x0E4A, 0xF715, 0xF890],
    [0x0E4B, 0xF716, 0xF893],
    [0x0E4C, 0xF717, 0xF896],
    [0x0E31, 0xF710, 0xF884], // MAI HAN-AKAT
    [0x0E34, 0xF701, 0xF885], // SARA I
    [0x0E35, 0xF702, 0xF886], // SARA II
    [0x0E36, 0xF703, 0xF887], // SARA UE
    [0x0E37, 0xF704, 0xF888], // SARA UEE
    [0x0E47, 0xF712, 0xF889], // MAITAIKHU
    [0x0E4D, 0xF711, 0xF899]  // NIKHAHIT
  ],
  [RD]: [
    [0x0E0D, 0xF70F, 0xF89A], // YO YING
    [0x0E10, 0xF700, 0xF89E]  // THO THAN
  ]
};

function thaiPuaShape(u, action, font) {
  if (action === NOP) return u;
  const mappings = PUA_MAPPINGS[action];
  if (!mappings) return u;
  for (const [orig, winPua, macPua] of mappings) {
    if (orig !== u) continue;
    if (font.hasGlyphForCodePoint(winPua)) return winPua;
    if (font.hasGlyphForCodePoint(macPua)) return macPua;
    break;
  }
  return u;
}

function replaceGlyphCodePoint(glyphs, index, newCp, font) {
  const prev = glyphs[index];
  if (prev.codePoints[0] === newCp) return;
  glyphs[index] = new GlyphInfo(font, font.glyphForCodePoint(newCp).id, [newCp], prev.features);
}

function applyThaiPuaShaping(glyphs, font) {
  let aboveState = ABOVE_START_STATE[NOT_CONSONANT];
  let belowState = BELOW_START_STATE[NOT_CONSONANT];
  let baseIndex = 0;

  for (let i = 0; i < glyphs.length; i++) {
    const u = glyphs[i].codePoints[0];
    const mt = getMarkType(u);

    if (mt === NOT_MARK) {
      const ct = getConsonantType(u);
      aboveState = ABOVE_START_STATE[ct];
      belowState = BELOW_START_STATE[ct];
      baseIndex = i;
      continue;
    }

    const [aboveAction, aboveNext] = ABOVE_STATE_MACHINE[aboveState][mt];
    const [belowAction, belowNext] = BELOW_STATE_MACHINE[belowState][mt];
    aboveState = aboveNext;
    belowState = belowNext;

    // At most one action is non-NOP.
    const action = aboveAction !== NOP ? aboveAction : belowAction;
    if (action === NOP) continue;

    if (action === RD) {
      replaceGlyphCodePoint(glyphs, baseIndex, thaiPuaShape(glyphs[baseIndex].codePoints[0], action, font), font);
    } else {
      replaceGlyphCodePoint(glyphs, i, thaiPuaShape(u, action, font), font);
    }
  }
}

// Gate PUA shaping on absence of Thai GSUB (HB plan->map.found_script[0]).
function hasThaiGsub(font) {
  const gsub = font.GSUB;
  if (!gsub || !gsub.scriptList) return false;
  return gsub.scriptList.some(entry => entry.tag === 'thai' || entry.tag === 'tha2');
}

function isThaiBufferScript(script) {
  if (Array.isArray(script)) return script.includes('thai');
  return script === 'thai';
}

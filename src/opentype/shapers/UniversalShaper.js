import DefaultShaper from './DefaultShaper';
import StateMachine from 'dfa';
import UnicodeTrie from '../../packages/unicode-trie/index.js';
import GlyphInfo from '../GlyphInfo';
import useData from './use.json';
import { decodeBase64 } from '../../utils';
import useTrie from './use.trie';

/** @typedef {import('../../../types/fontkit').ShapingPlanLike} ShapingPlanLike */
/** @typedef {import('../../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../../types/fontkit').USEShaperInfo} USEShaperInfo */
/** @typedef {import('dfa').StateMachineDefinition} StateMachineDefinition */

/**
 * Generated USE payload: category tables plus a compiled `dfa` machine
 * (`stateTable` / `accepting` / `tags`). Extra keys are fine — StateMachine
 * only reads the three DFA fields.
 *
 * @typedef {StateMachineDefinition & {
 *   categories: string[],
 *   decompositions: Record<string, number[]>
 * }} UseData
 */

/** @type {UseData} */
const useDataTyped = /** @type {UseData} */ (useData);
const { categories, decompositions } = useDataTyped;
const trie = new UnicodeTrie(decodeBase64(useTrie));
const stateMachine = new StateMachine(useDataTyped);

/**
 * This shaper is an implementation of the Universal Shaping Engine, which
 * uses Unicode data to shape a number of scripts without a dedicated shaping engine.
 * See https://www.microsoft.com/typography/OpenTypeDev/USE/intro.htm.
 */
export default class UniversalShaper extends DefaultShaper {
  static zeroMarkWidths = 'BEFORE_GPOS';
  /**
   * @param {ShapingPlanLike} plan
   */
  static planFeatures(plan) {
    plan.addStage(setupSyllables);

    // Default glyph pre-processing group
    plan.addStage(['locl', 'ccmp', 'nukt', 'akhn']);

    // Reordering group
    plan.addStage(clearSubstitutionFlags);
    plan.addStage(['rphf'], false);
    plan.addStage(recordRphf);
    plan.addStage(clearSubstitutionFlags);
    plan.addStage(['pref']);
    plan.addStage(recordPref);

    // Orthographic unit shaping group
    plan.addStage(['rkrf', 'abvf', 'blwf', 'half', 'pstf', 'vatu', 'cjct']);
    plan.addStage(reorder);

    // Topographical features
    // Scripts that need this are handled by the Arabic shaper, not implemented here for now.
    // plan.addStage(['isol', 'init', 'medi', 'fina', 'med2', 'fin2', 'fin3'], false);

    // Standard topographic presentation and positional feature application
    plan.addStage(['abvs', 'blws', 'pres', 'psts', 'dist', 'abvm', 'blwm']);
  }

  /**
   * @param {ShapingPlanLike} plan
   * @param {GlyphInfoLike[]} glyphs
   */
  static assignFeatures(plan, glyphs) {
    // Decompose split vowels
    // TODO: do this in a more general unicode normalizer
    for (let i = glyphs.length - 1; i >= 0; i--) {
      let codepoint = glyphs[i].codePoints[0];
      let decomp = decompositions[String(codepoint)] || decompositions[/** @type {keyof typeof decompositions} */ (/** @type {unknown} */ (codepoint))];
      if (decomp) {
        /** @type {GlyphInfo[]} */
        let decomposed = [];
        for (let c of decomp) {
          let g = plan.font.glyphForCodePoint(c);
          if (g) {
            decomposed.push(new GlyphInfo(plan.font, g.id, [c], glyphs[i].features));
          }
        }

        glyphs.splice(i, 1, ...decomposed);
      }
    }
  }
}

/** @param {GlyphInfoLike} glyph @returns {number} */
function useCategory(glyph) {
  return trie.get(glyph.codePoints[0]);
}

class USEInfo {
  /**
   * @param {string} category
   * @param {string} syllableType
   * @param {number} syllable
   */
  constructor(category, syllableType, syllable) {
    this.category = category;
    this.syllableType = syllableType;
    this.syllable = syllable;
  }
}

/**
 * @param {import('../../../types/fontkit').IndicShaperInfo | import('../../../types/fontkit').USEShaperInfo | null} info
 * @returns {info is USEShaperInfo}
 */
function isUSEShaperInfo(info) {
  return info != null && typeof info.category === 'string';
}

/**
 * @param {GlyphInfoLike} glyph
 * @returns {USEShaperInfo}
 */
function useInfo(glyph) {
  let info = glyph.shaperInfo;
  if (!isUSEShaperInfo(info)) {
    throw new Error('Expected USE shaperInfo');
  }
  return info;
}

/** @type {import('../../../types/fontkit').ShapingStageFn} */
function setupSyllables(font, glyphs) {
  let syllable = 0;
  for (let [start, end, tags] of stateMachine.match(glyphs.map(useCategory))) {
    ++syllable;

    // Create shaper info
    for (let i = start; i <= end; i++) {
      glyphs[i].shaperInfo = new USEInfo(categories[useCategory(glyphs[i])], tags[0], syllable);
    }

    // Assign rphf feature
    let limit = useInfo(glyphs[start]).category === 'R' ? 1 : Math.min(3, end - start);
    for (let i = start; i < start + limit; i++) {
      glyphs[i].features.rphf = true;
    }
  }
}

/** @type {import('../../../types/fontkit').ShapingStageFn} */
function clearSubstitutionFlags(font, glyphs) {
  for (let glyph of glyphs) {
    glyph.substituted = false;
  }
}

/** @type {import('../../../types/fontkit').ShapingStageFn} */
function recordRphf(font, glyphs) {
  for (let glyph of glyphs) {
    if (glyph.substituted && glyph.features.rphf) {
      // Mark a substituted repha.
      useInfo(glyph).category = 'R';
    }
  }
}

/** @type {import('../../../types/fontkit').ShapingStageFn} */
function recordPref(font, glyphs) {
  for (let glyph of glyphs) {
    if (glyph.substituted) {
      // Mark a substituted pref as VPre, as they behave the same way.
      useInfo(glyph).category = 'VPre';
    }
  }
}

/** @type {import('../../../types/fontkit').ShapingStageFn} */
function reorder(font, glyphs) {
  let dottedCircleGlyph = font.glyphForCodePoint(0x25cc);
  let dottedCircle = dottedCircleGlyph ? dottedCircleGlyph.id : 0;

  for (let start = 0, end = nextSyllable(glyphs, 0); start < glyphs.length; start = end, end = nextSyllable(glyphs, start)) {
    let i, j;
    let info = useInfo(glyphs[start]);
    let type = info.syllableType;

    // Only a few syllable types need reordering.
    if (type !== 'virama_terminated_cluster' && type !== 'standard_cluster' && type !== 'broken_cluster') {
      continue;
    }

    // Insert a dotted circle glyph in broken clusters.
    if (type === 'broken_cluster' && dottedCircle) {
      let g = new GlyphInfo(font, dottedCircle, [0x25cc]);
      g.shaperInfo = info;

      // Insert after possible Repha.
      for (i = start; i < end && useInfo(glyphs[i]).category === 'R'; i++);
      glyphs.splice(i + 1, 0, g);
      end++;
    }

    // Move things forward.
    if (info.category === 'R' && end - start > 1) {
      // Got a repha. Reorder it to after first base, before first halant.
      for (i = start + 1; i < end; i++) {
        info = useInfo(glyphs[i]);
        if (isBase(info) || isHalant(glyphs[i])) {
          // If we hit a halant, move before it; otherwise it's a base: move to it's
          // place, and shift things in between backward.
          if (isHalant(glyphs[i])) {
            i--;
          }

          glyphs.splice(start, 0, ...glyphs.splice(start + 1, i - start), glyphs[i]);
          break;
        }
      }
    }

    // Move things back.
    for (i = start, j = end; i < end; i++) {
      info = useInfo(glyphs[i]);
      if (isBase(info) || isHalant(glyphs[i])) {
        // If we hit a halant, move after it; otherwise it's a base: move to it's
        // place, and shift things in between backward.
        j = isHalant(glyphs[i]) ? i + 1 : i;
      } else if ((info.category === 'VPre' || info.category === 'VMPre') && j < i) {
        glyphs.splice(j, 1, glyphs[i], ...glyphs.splice(j, i - j));
      }
    }
  }
}

/** @param {GlyphInfoLike[]} glyphs @param {number} start @returns {number} */
function nextSyllable(glyphs, start) {
  if (start >= glyphs.length) return start;
  let syllable = useInfo(glyphs[start]).syllable;
  while (++start < glyphs.length && useInfo(glyphs[start]).syllable === syllable);
  return start;
}

/** @param {GlyphInfoLike} glyph @returns {boolean} */
function isHalant(glyph) {
  return useInfo(glyph).category === 'H' && !glyph.isLigated;
}

/** @param {USEShaperInfo} info @returns {boolean} */
function isBase(info) {
  return info.category === 'B' || info.category === 'GB';
}

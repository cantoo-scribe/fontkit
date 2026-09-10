import ShapingPlan from './ShapingPlan';
import * as Shapers from './shapers';
import GlyphInfo from './GlyphInfo';
import GSUBProcessor from './GSUBProcessor';
import GPOSProcessor from './GPOSProcessor';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').GlyphRunLike} GlyphRunLike */
/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */
/** @typedef {import('../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../../types/fontkit').LanguageTag} LanguageTag */
/** @typedef {import('../../types/fontkit').LayoutGlyph} LayoutGlyph */
/** @typedef {import('../../types/fontkit').ShaperLike} ShaperLike */

export default class OTLayoutEngine {
  /**
   * @param {LayoutFont} font
   */
  constructor(font) {
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {GlyphInfo[] | null} */
    this.glyphInfos = null;
    /** @type {ShapingPlan | null} */
    this.plan = null;
    /** @type {GSUBProcessor | null} */
    this.GSUBProcessor = null;
    /** @type {GPOSProcessor | null} */
    this.GPOSProcessor = null;
    /** @type {boolean} */
    this.fallbackPosition = true;
    /** @type {ShaperLike | null} */
    this.shaper = null;

    if (font.GSUB) {
      this.GSUBProcessor = new GSUBProcessor(font, font.GSUB);
    }

    if (font.GPOS) {
      this.GPOSProcessor = new GPOSProcessor(font, font.GPOS);
    }
  }

  /**
   * @param {GlyphRunLike} glyphRun
   */
  setup(glyphRun) {
    // Map glyphs to GlyphInfo objects so data can be passed between
    // GSUB and GPOS without mutating the real (shared) Glyph objects.
    this.glyphInfos = /** @type {LayoutGlyph[]} */ (glyphRun.glyphs).map(
      /** @param {LayoutGlyph} glyph */ glyph => new GlyphInfo(this.font, glyph.id, [...glyph.codePoints])
    );

    // Select an OpenType script for GSUB/GPOS features.
    /** @type {string | null} */
    let script = null;
    if (this.GPOSProcessor) {
      script = this.GPOSProcessor.selectScript(glyphRun.script, glyphRun.language, glyphRun.direction);
    }

    if (this.GSUBProcessor) {
      script = this.GSUBProcessor.selectScript(glyphRun.script, glyphRun.language, glyphRun.direction);
    }

    // Choose the complex shaper from the buffer Unicode script (HB model). The OT
    // script may fall back to DFLT/latn even for Thai text; that must not select
    // DefaultShaper or Thai SARA AM / PUA preprocessing is skipped.
    this.shaper = /** @type {ShaperLike} */ (Shapers.choose(glyphRun.script || script));
    this.plan = new ShapingPlan(this.font, script || glyphRun.script, glyphRun.direction);
    this.plan.bufferScript = glyphRun.script;
    this.shaper.plan(this.plan, this.glyphInfos, glyphRun.features);

    // Enabled features as true, then overlay user values (e.g. aalt: 2) without mutating input.
    /** @type {FeatureMap} */
    let features = {};
    for (let key in this.plan.allFeatures) {
      features[key] = true;
    }
    glyphRun.features = Object.assign(features, glyphRun.features);
  }

  /**
   * @param {GlyphRunLike} glyphRun
   */
  substitute(glyphRun) {
    if (this.GSUBProcessor && this.plan && this.glyphInfos) {
      this.plan.process(this.GSUBProcessor, this.glyphInfos);

      // Map glyph infos back to normal Glyph objects
      /** @type {LayoutGlyph[]} */
      let glyphs = [];
      for (let glyphInfo of this.glyphInfos) {
        let g = this.font.getGlyph(glyphInfo.id, glyphInfo.codePoints);
        if (g) {
          glyphs.push(g);
        }
      }
      glyphRun.glyphs = glyphs;
    }
  }

  /**
   * @param {GlyphRunLike} glyphRun
   * @returns {FeatureMap | Record<string, import('../../types/fontkit').OTFeature> | null | undefined | false}
   */
  position(glyphRun) {
    if (this.shaper && this.shaper.zeroMarkWidths === 'BEFORE_GPOS' && glyphRun.positions) {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    if (this.GPOSProcessor && this.plan && this.glyphInfos && glyphRun.positions) {
      this.plan.process(this.GPOSProcessor, this.glyphInfos, glyphRun.positions);
    }

    if (this.shaper && this.shaper.zeroMarkWidths === 'AFTER_GPOS' && glyphRun.positions) {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    // Reverse the glyphs and positions if the script is right-to-left
    if (glyphRun.direction === 'rtl') {
      glyphRun.glyphs.reverse();
      if (glyphRun.positions) {
        glyphRun.positions.reverse();
      }
    }

    return this.GPOSProcessor && this.GPOSProcessor.features;
  }

  /**
   * @param {GlyphPositionLike[]} positions
   */
  zeroMarkAdvances(positions) {
    if (!this.glyphInfos) {
      return;
    }

    for (let i = 0; i < this.glyphInfos.length; i++) {
      if (this.glyphInfos[i].isMark) {
        positions[i].xAdvance = 0;
        positions[i].yAdvance = 0;
      }
    }
  }

  cleanup() {
    this.glyphInfos = null;
    this.plan = null;
    this.shaper = null;
  }

  /**
   * @param {ScriptTag | string[] | null | undefined} script
   * @param {LanguageTag | null | undefined} language
   * @returns {string[]}
   */
  getAvailableFeatures(script, language) {
    /** @type {string[]} */
    let features = [];

    if (this.GSUBProcessor) {
      this.GSUBProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GSUBProcessor.features));
    }

    if (this.GPOSProcessor) {
      this.GPOSProcessor.selectScript(script, language);
      features.push(...Object.keys(this.GPOSProcessor.features));
    }

    return features;
  }
}

import ShapingPlan from './ShapingPlan';
import * as Shapers from './shapers';
import GlyphInfo from './GlyphInfo';
import GSUBProcessor from './GSUBProcessor';
import GPOSProcessor from './GPOSProcessor';

export default class OTLayoutEngine {
  constructor(font) {
    this.font = font;
    this.glyphInfos = null;
    this.plan = null;
    this.GSUBProcessor = null;
    this.GPOSProcessor = null;
    this.fallbackPosition = true;

    if (font.GSUB) {
      this.GSUBProcessor = new GSUBProcessor(font, font.GSUB);
    }

    if (font.GPOS) {
      this.GPOSProcessor = new GPOSProcessor(font, font.GPOS);
    }
  }

  setup(glyphRun) {
    // Map glyphs to GlyphInfo objects so data can be passed between
    // GSUB and GPOS without mutating the real (shared) Glyph objects.
    this.glyphInfos = glyphRun.glyphs.map(glyph => new GlyphInfo(this.font, glyph.id, [...glyph.codePoints]));

    // Select an OpenType script for GSUB/GPOS features.
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
    this.shaper = Shapers.choose(glyphRun.script || script);
    this.plan = new ShapingPlan(this.font, script || glyphRun.script, glyphRun.direction);
    this.plan.bufferScript = glyphRun.script;
    this.shaper.plan(this.plan, this.glyphInfos, glyphRun.features);

    // Enabled features as true, then overlay user values (e.g. aalt: 2) without mutating input.
    let features = {};
    for (let key in this.plan.allFeatures) {
      features[key] = true;
    }
    glyphRun.features = Object.assign(features, glyphRun.features);
  }

  substitute(glyphRun) {
    if (this.GSUBProcessor) {
      this.plan.process(this.GSUBProcessor, this.glyphInfos);

      // Map glyph infos back to normal Glyph objects
      glyphRun.glyphs = this.glyphInfos.map(glyphInfo => this.font.getGlyph(glyphInfo.id, glyphInfo.codePoints));
    }
  }

  position(glyphRun) {
    if (this.shaper.zeroMarkWidths === 'BEFORE_GPOS') {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    if (this.GPOSProcessor) {
      this.plan.process(this.GPOSProcessor, this.glyphInfos, glyphRun.positions);
    }

    if (this.shaper.zeroMarkWidths === 'AFTER_GPOS') {
      this.zeroMarkAdvances(glyphRun.positions);
    }

    // Reverse the glyphs and positions if the script is right-to-left
    if (glyphRun.direction === 'rtl') {
      glyphRun.glyphs.reverse();
      glyphRun.positions.reverse();
    }

    return this.GPOSProcessor && this.GPOSProcessor.features;
  }

  zeroMarkAdvances(positions) {
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

  getAvailableFeatures(script, language) {
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

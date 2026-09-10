import KernProcessor from './KernProcessor';
import UnicodeLayoutEngine from './UnicodeLayoutEngine';
import GlyphRun from './GlyphRun';
import GlyphPosition from './GlyphPosition';
import * as Script from './Script';
import AATLayoutEngine from '../aat/AATLayoutEngine';
import OTLayoutEngine from '../opentype/OTLayoutEngine';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').LayoutGlyph} LayoutGlyph */
/** @typedef {import('../../types/fontkit').FeatureInput} FeatureInput */
/** @typedef {import('../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../../types/fontkit').LanguageTag} LanguageTag */
/** @typedef {import('../../types/fontkit').TextDirection} TextDirection */
/** @typedef {import('../../types/fontkit').AdvancedLayoutEngine} AdvancedLayoutEngine */
/** @typedef {import('../../types/fontkit').GlyphRunLike} GlyphRunLike */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */
/** @typedef {import('./GlyphRun').default} GlyphRunInstance */

export default class LayoutEngine {
  /**
   * @param {LayoutFont} font
   */
  constructor(font) {
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {UnicodeLayoutEngine | null} */
    this.unicodeLayoutEngine = null;
    /** @type {KernProcessor | null} */
    this.kernProcessor = null;
    /** @type {AdvancedLayoutEngine | undefined} */
    this.engine = undefined;

    // Choose an advanced layout engine. We try the AAT morx table first since more
    // scripts are currently supported because the shaping logic is built into the font.
    if (this.font.morx) {
      this.engine = /** @type {AdvancedLayoutEngine} */ (new AATLayoutEngine(this.font));
    } else if (this.font.GSUB || this.font.GPOS) {
      this.engine = /** @type {AdvancedLayoutEngine} */ (new OTLayoutEngine(this.font));
    }
  }

  /**
   * @param {string | LayoutGlyph[]} string
   * @param {FeatureInput | ScriptTag | string[] | null | undefined} [features]
   * @param {ScriptTag | string[] | LanguageTag | null | undefined} [script]
   * @param {LanguageTag | TextDirection | null | undefined} [language]
   * @param {TextDirection | null | undefined} [direction]
   * @returns {GlyphRunInstance}
   */
  layout(string, features, script, language, direction) {
    // Make the features parameter optional
    if (typeof features === 'string') {
      direction = /** @type {TextDirection | null | undefined} */ (language);
      language = /** @type {LanguageTag | null | undefined} */ (script);
      script = features;
      features = [];
    }

    // Map string to glyphs if needed
    /** @type {LayoutGlyph[]} */
    let glyphs;
    if (typeof string === 'string') {
      // Attempt to detect the script from the string if not provided.
      if (script == null) {
        script = Script.forString(string);
      }

      glyphs = this.font.glyphsForString(string);
    } else {
      // Attempt to detect the script from the glyph code points if not provided.
      if (script == null) {
        /** @type {number[]} */
        let codePoints = [];
        for (let glyph of string) {
          codePoints.push(...glyph.codePoints);
        }

        script = Script.forCodePoints(codePoints);
      }

      glyphs = string;
    }

    let glyphRun = new GlyphRun(
      /** @type {import('../glyph/Glyph').default[]} */ (glyphs),
      /** @type {FeatureInput | null | undefined} */ (features),
      script,
      /** @type {LanguageTag | null | undefined} */ (language),
      /** @type {TextDirection | null | undefined} */ (direction)
    );

    // Return early if there are no glyphs
    if (glyphs.length === 0) {
      glyphRun.positions = [];
      return glyphRun;
    }

    // Setup the advanced layout engine
    if (this.engine && this.engine.setup) {
      this.engine.setup(/** @type {GlyphRunLike} */ (glyphRun));
    }

    // Substitute and position the glyphs
    this.substitute(glyphRun);
    this.position(glyphRun);

    if (glyphRun.positions) {
      this.hideDefaultIgnorables(/** @type {LayoutGlyph[]} */ (glyphRun.glyphs), glyphRun.positions);
    }

    // Let the layout engine clean up any state it might have
    if (this.engine && this.engine.cleanup) {
      this.engine.cleanup();
    }

    return glyphRun;
  }

  /**
   * @param {GlyphRunInstance} glyphRun
   */
  substitute(glyphRun) {
    // Call the advanced layout engine to make substitutions
    if (this.engine && this.engine.substitute) {
      this.engine.substitute(/** @type {GlyphRunLike} */ (glyphRun));
    }
  }

  /**
   * @param {GlyphRunInstance} glyphRun
   */
  position(glyphRun) {
    // Get initial glyph positions
    glyphRun.positions = /** @type {LayoutGlyph[]} */ (glyphRun.glyphs).map(
      /** @param {LayoutGlyph} glyph */ glyph => new GlyphPosition(glyph.advanceWidth)
    );
    /** @type {FeatureMap | Record<string, import('../../types/fontkit').OTFeature> | null | undefined | false} */
    let positioned = null;

    // Call the advanced layout engine. Returns the features applied.
    if (this.engine && this.engine.position) {
      positioned = this.engine.position(/** @type {GlyphRunLike} */ (glyphRun));
    }

    // if there is no GPOS table, use unicode properties to position marks.
    if (!positioned && (!this.engine || this.engine.fallbackPosition)) {
      if (!this.unicodeLayoutEngine) {
        this.unicodeLayoutEngine = new UnicodeLayoutEngine(this.font);
      }

      this.unicodeLayoutEngine.positionGlyphs(
        /** @type {LayoutGlyph[]} */ (glyphRun.glyphs),
        /** @type {GlyphPositionLike[]} */ (glyphRun.positions)
      );
    }

    // if kerning is not supported by GPOS, do kerning with the TrueType/AAT kern table
    if ((!positioned || !positioned.kern) && glyphRun.features.kern !== false && this.font.kern) {
      if (!this.kernProcessor) {
        this.kernProcessor = new KernProcessor(this.font);
      }

      this.kernProcessor.process(
        /** @type {LayoutGlyph[]} */ (glyphRun.glyphs),
        /** @type {GlyphPositionLike[]} */ (glyphRun.positions)
      );
      glyphRun.features.kern = true;
    }
  }

  /**
   * @param {LayoutGlyph[]} glyphs
   * @param {GlyphPositionLike[]} positions
   */
  hideDefaultIgnorables(glyphs, positions) {
    let space = this.font.glyphForCodePoint(0x20);
    if (!space) {
      return;
    }
    for (let i = 0; i < glyphs.length; i++) {
      if (this.isDefaultIgnorable(glyphs[i].codePoints[0])) {
        glyphs[i] = space;
        positions[i].xAdvance = 0;
        positions[i].yAdvance = 0;
      }
    }
  }

  /**
   * @param {number} ch
   * @returns {boolean}
   */
  isDefaultIgnorable(ch) {
    // From DerivedCoreProperties.txt in the Unicode database,
    // minus U+115F, U+1160, U+3164 and U+FFA0, which is what
    // Harfbuzz and Uniscribe do.
    let plane = ch >> 16;
    if (plane === 0) {
      // BMP
      switch (ch >> 8) {
        case 0x00: return ch === 0x00AD;
        case 0x03: return ch === 0x034F;
        case 0x06: return ch === 0x061C;
        case 0x17: return 0x17B4 <= ch && ch <= 0x17B5;
        case 0x18: return 0x180B <= ch && ch <= 0x180E;
        case 0x20: return (0x200B <= ch && ch <= 0x200F) || (0x202A <= ch && ch <= 0x202E) || (0x2060 <= ch && ch <= 0x206F);
        case 0xFE: return (0xFE00 <= ch && ch <= 0xFE0F) || ch === 0xFEFF;
        case 0xFF: return 0xFFF0 <= ch && ch <= 0xFFF8;
        default: return false;
      }
    } else {
      // Other planes
      switch (plane) {
        case 0x01: return (0x1BCA0 <= ch && ch <= 0x1BCA3) || (0x1D173 <= ch && ch <= 0x1D17A);
        case 0x0E: return 0xE0000 <= ch && ch <= 0xE0FFF;
        default: return false;
      }
    }
  }

  /**
   * @param {ScriptTag | string[] | null | undefined} [script]
   * @param {LanguageTag | null | undefined} [language]
   * @returns {string[]}
   */
  getAvailableFeatures(script, language) {
    /** @type {string[]} */
    let features = [];

    if (this.engine) {
      features.push(...this.engine.getAvailableFeatures(script, language));
    }

    if (this.font.kern && features.indexOf('kern') === -1) {
      features.push('kern');
    }

    return features;
  }

  /**
   * @param {number} gid
   * @returns {string[]}
   */
  stringsForGlyph(gid) {
    let result = new Set();

    let codePoints = this.font._cmapProcessor.codePointsForGlyph(gid);
    for (let codePoint of codePoints) {
      result.add(String.fromCodePoint(codePoint));
    }

    if (this.engine && this.engine.stringsForGlyph) {
      for (let string of this.engine.stringsForGlyph(gid)) {
        result.add(string);
      }
    }

    return Array.from(result);
  }
}

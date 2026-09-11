import { defineCached } from './decorators';
import * as fontkit from './base';
import * as r from 'restructure';
import Directory from './tables/directory';
import tables from './tables';
import CmapProcessor from './CmapProcessor';
import LayoutEngine from './layout/LayoutEngine';
import TTFGlyph from './glyph/TTFGlyph';
import CFFGlyph from './glyph/CFFGlyph';
import SBIXGlyph from './glyph/SBIXGlyph';
import COLRGlyph from './glyph/COLRGlyph';
import CBDTGlyph from './glyph/CBDTGlyph';
import GlyphVariationProcessor from './glyph/GlyphVariationProcessor';
import TTFSubset from './subset/TTFSubset';
import CFFSubset from './subset/CFFSubset';
import BBox from './glyph/BBox';
import { asciiDecoder } from './utils';

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('../types/fontkit').FontDirectory} FontDirectory */
/** @typedef {import('../types/fontkit').FontLike} FontLike */
/** @typedef {import('../types/fontkit').FontMetrics} FontMetrics */
/** @typedef {import('../types/fontkit').TableEntry} TableEntry */
/** @typedef {import('../types/fontkit').TableCodec} TableCodec */
/** @typedef {import('../types/fontkit').VariationCoords} VariationCoords */
/** @typedef {import('../types/fontkit').NameString} NameString */
/** @typedef {import('../types/fontkit').HeadTable} HeadTable */
/** @typedef {import('../types/fontkit').HheaTable} HheaTable */
/** @typedef {import('../types/fontkit').MaxpTable} MaxpTable */
/** @typedef {import('../types/fontkit').OS2Table} OS2Table */
/** @typedef {import('../types/fontkit').NameTable} NameTable */
/** @typedef {import('../types/fontkit').PostTable} PostTable */
/** @typedef {import('../types/fontkit').CmapTable} CmapTable */
/** @typedef {import('../types/fontkit').MetricsTable} MetricsTable */
/** @typedef {import('../types/fontkit').FvarTable} FvarTable */
/** @typedef {import('../types/fontkit').FvarAxis} FvarAxis */
/** @typedef {import('../types/fontkit').CFFFontLike} CFFFontLike */
/** @typedef {import('../types/fontkit').FeatureInput} FeatureInput */
/** @typedef {import('../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../types/fontkit').LanguageTag} LanguageTag */
/** @typedef {import('../types/fontkit').TextDirection} TextDirection */
/** @typedef {import('./glyph/Glyph').default} Glyph */
/** @typedef {import('./layout/GlyphRun').default} GlyphRun */
/** @typedef {import('./subset/Subset').default} Subset */

/**
 * Axis description from {@link TTFFont#variationAxes}.
 * @typedef {{ name: NameString | undefined, min: number, default: number, max: number }} VariationAxisInfo
 */

/**
 * This is the base class for all SFNT-based font formats in fontkit.
 * It supports TrueType, and PostScript glyphs, and several color glyph formats.
 *
 * Dynamic SFNT table accessors (`cmap`, `head`, `hhea`, …) are installed by
 * `_installTableGetters` and typed here so call sites see real table shapes.
 *
 * @implements {FontLike}
 */
export default class TTFFont {
  /** @type {string} */
  type = 'TTF';

  /** @type {DecodeStream} */
  stream = new r.DecodeStream(new Uint8Array(0));
  /** @type {FontDirectory} */
  directory = /** @type {FontDirectory} */ ({ tables: {} });
  /** @type {string | null} */
  defaultLanguage = null;
  /** @type {number[] | null} */
  variationCoords = null;
  /** @type {number} */
  _directoryPos = 0;
  /** @type {Record<string, unknown>} */
  _tables = {};
  /** @type {Record<number, Glyph | undefined>} */
  _glyphs = {};
  /** @type {FontMetrics | undefined} */
  _metrics;

  // SFNT tables installed as configurable getters by `_installTableGetters`.
  /** @type {CmapTable | undefined} */
  cmap;
  /** @type {HeadTable} */
  head = /** @type {HeadTable} */ ({ unitsPerEm: 0, xMin: 0, yMin: 0, xMax: 0, yMax: 0 });
  /** @type {HheaTable | undefined} */
  hhea;
  /** @type {MetricsTable} */
  hmtx = /** @type {MetricsTable} */ ({
    metrics: { length: 0, get() { return undefined; } },
    bearings: { length: 0, get() { return undefined; } }
  });

  /** @type {MaxpTable} */
  maxp = { numGlyphs: 0 };
  /** @type {NameTable | undefined} */
  name;
  /** @type {OS2Table | undefined} */
  'OS/2';
  /** @type {PostTable} */
  post = { version: 0, italicAngle: 0, underlinePosition: 0, underlineThickness: 0 };
  /** @type {FvarTable | undefined} */
  fvar;
  /** @type {CFFFontLike | undefined} */
  CFF2;
  /** @type {CFFFontLike | undefined} */
  'CFF ';

  /**
   * @param {ArrayBufferView} buffer
   * @returns {boolean}
   */
  static probe(buffer) {
    let bytes
      = buffer instanceof Uint8Array
        ? buffer
        : new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    let format = asciiDecoder.decode(bytes.subarray(0, 4));
    return format === 'true' || format === 'OTTO' || format === String.fromCharCode(0, 1, 0, 0);
  }

  /**
   * @param {DecodeStream} stream
   * @param {number[] | null} [variationCoords]
   */
  constructor(stream, variationCoords = null) {
    this.defaultLanguage = null;
    this.stream = stream;
    this.variationCoords = variationCoords;

    this._directoryPos = this.stream.pos;
    this._tables = {};
    this._glyphs = {};
    this._metrics = undefined;
    this.directory = /** @type {FontDirectory} */ ({ tables: {} });

    this._decodeDirectory();
    this._installTableGetters();
  }

  /**
   * @param {DecodeStream} stream
   * @returns {void}
   */
  _setStream(stream) {
    this.stream = stream;
  }

  /** @returns {void} */
  _installTableGetters() {
    let tableMap = this.directory.tables;
    for (let tag in tableMap) {
      let table = tableMap[tag];
      let codec = tables[tag];
      if (codec && table && table.length > 0) {
        Object.defineProperty(this, tag, {
          get: this._getTable.bind(this, table),
          configurable: true
        });
      }
    }
  }

  /**
   * @param {string | null} [lang]
   * @returns {void}
   */
  setDefaultLanguage(lang = null) {
    this.defaultLanguage = lang;
  }

  /**
   * @param {TableEntry} table
   * @returns {unknown}
   */
  _getTable(table) {
    if (!(table.tag in this._tables)) {
      try {
        this._tables[table.tag] = this._decodeTable(table);
      } catch (e) {
        if (fontkit.logErrors) {
          console.error(`Error decoding table ${table.tag}`);
          let err = /** @type {{ stack?: string }} */ (e);
          console.error(err.stack);
        }
      }
    }

    return this._tables[table.tag];
  }

  /**
   * @param {string} tag
   * @returns {DecodeStream | null}
   */
  _getTableStream(tag) {
    let table = this.directory.tables[tag];
    if (table) {
      this.stream.pos = table.offset;
      return this.stream;
    }

    return null;
  }

  /** @returns {void} */
  _decodeDirectory() {
    this.directory = /** @type {FontDirectory} */ (
      /** @type {unknown} */ (Directory.decode(this.stream, { _startOffset: 0 }))
    );
  }

  /**
   * @param {TableEntry} table
   * @returns {unknown}
   */
  _decodeTable(table) {
    let pos = this.stream.pos;

    let stream = this._getTableStream(table.tag);
    let codec = /** @type {TableCodec | undefined} */ (tables[table.tag]);
    if (!stream || !codec || !codec.decode) {
      this.stream.pos = pos;
      return undefined;
    }

    let result = codec.decode(stream, this, table.length);

    this.stream.pos = pos;
    return result;
  }

  /**
   * @returns {FontMetrics}
   */
  _getMetrics() {
    if (this._metrics) {
      return this._metrics;
    }

    // Same compromise as FreeType for ascender/descender/height:
    // https://gitlab.freedesktop.org/freetype/freetype/-/blob/master/src/sfnt/sfobjs.c
    // typo*/win* fields exist only in OS/2 version >= 1
    let os2 = this['OS/2'];
    let hasTypo = !!(os2 && os2.version > 0);
    /** @type {number} */
    let ascent;
    /** @type {number} */
    let descent;
    /** @type {number} */
    let lineGap;

    if (hasTypo && os2 && os2.fsSelection.useTypoMetrics) {
      ascent = /** @type {number} */ (os2.typoAscender);
      descent = /** @type {number} */ (os2.typoDescender);
      lineGap = /** @type {number} */ (os2.typoLineGap);
    } else {
      let hhea = this.hhea;
      if (!hhea) {
        throw new Error('Missing hhea table');
      }
      ({ ascent, descent, lineGap } = hhea);

      // Only when both hhea values are zero — FreeType uses !(ascender || descender)
      if (!(ascent || descent) && hasTypo && os2) {
        if (os2.typoAscender || os2.typoDescender) {
          ascent = /** @type {number} */ (os2.typoAscender);
          descent = /** @type {number} */ (os2.typoDescender);
          lineGap = /** @type {number} */ (os2.typoLineGap);
        } else {
          ascent = /** @type {number} */ (os2.winAscent);
          descent = -(/** @type {number} */ (os2.winDescent));
          lineGap = 0;
        }
      }
    }

    return this._metrics = {
      ascent,
      descent,
      lineGap,
      lineHeight: ascent - descent + lineGap
    };
  }

  /**
   * Gets a string from the font's `name` table
   * `lang` is a BCP-47 language code.
   * @param {string} key
   * @param {string | null} [lang]
   * @returns {NameString | null}
   */
  getName(key, lang = this.defaultLanguage || fontkit.defaultLanguage) {
    let record = this.name && this.name.records[key];
    if (record && typeof record === 'object') {
      // Attempt to retrieve the entry, depending on which translation is available:
      /** @type {import('../types/fontkit').NameLocaleMap} */
      let locales = /** @type {import('../types/fontkit').NameLocaleMap} */ (record);
      return (
        (lang ? locales[lang] : undefined)
        || (this.defaultLanguage ? locales[this.defaultLanguage] : undefined)
        || locales[fontkit.defaultLanguage]
        || locales['en']
        || locales[Object.keys(locales)[0]] // Seriously, ANY language would be fine
        || null
      );
    }

    return null;
  }

  /**
   * The unique PostScript name for this font, e.g. "Helvetica-Bold"
   * @type {NameString | null}
   */
  get postscriptName() {
    return this.getName('postscriptName');
  }

  /**
   * The font's full name, e.g. "Helvetica Bold"
   * @type {NameString | null}
   */
  get fullName() {
    return this.getName('fullName');
  }

  /**
   * The font's family name, e.g. "Helvetica"
   * @type {NameString | null}
   */
  get familyName() {
    return this.getName('fontFamily');
  }

  /**
   * The font's sub-family, e.g. "Bold".
   * @type {NameString | null}
   */
  get subfamilyName() {
    return this.getName('fontSubfamily');
  }

  /**
   * The font's copyright information
   * @type {NameString | null}
   */
  get copyright() {
    return this.getName('copyright');
  }

  /**
   * The font's version number
   * @type {NameString | null}
   */
  get version() {
    return this.getName('version');
  }

  /**
   * The font’s [ascender](https://en.wikipedia.org/wiki/Ascender_(typography))
   * @type {number}
   */
  get ascent() {
    return this._getMetrics().ascent;
  }

  /**
   * The font’s [descender](https://en.wikipedia.org/wiki/Descender)
   * @type {number}
   */
  get descent() {
    return this._getMetrics().descent;
  }

  /**
   * The amount of space that should be included between lines
   * @type {number}
   */
  get lineGap() {
    return this._getMetrics().lineGap;
  }

  /**
   * The offset from the normal underline position that should be used
   * @type {number}
   */
  get underlinePosition() {
    return this.post.underlinePosition;
  }

  /**
   * The weight of the underline that should be used
   * @type {number}
   */
  get underlineThickness() {
    return this.post.underlineThickness;
  }

  /**
   * If this is an italic font, the angle the cursor should be drawn at to match the font design
   * @type {number}
   */
  get italicAngle() {
    return this.post.italicAngle;
  }

  /**
   * The vertical space between adjacent lines (their baselines) of text.
   * See [here](https://en.wikipedia.org/wiki/Leading) for more details.
   * @type {number}
   */
  get lineHeight() {
    return this._getMetrics().lineHeight;
  }

  /**
   * The height of capital letters above the baseline.
   * See [here](https://en.wikipedia.org/wiki/Cap_height) for more details.
   * @type {number}
   */
  get capHeight() {
    let os2 = this['OS/2'];
    return os2 && os2.capHeight != null ? os2.capHeight : this.ascent;
  }

  /**
   * The height of lower case letters in the font.
   * See [here](https://en.wikipedia.org/wiki/X-height) for more details.
   * @type {number}
   */
  get xHeight() {
    let os2 = this['OS/2'];
    return os2 && os2.xHeight != null ? os2.xHeight : 0;
  }

  /**
   * The number of glyphs in the font.
   * @type {number}
   */
  get numGlyphs() {
    return this.maxp.numGlyphs;
  }

  /**
   * The size of the font’s internal coordinate grid
   * @type {number}
   */
  get unitsPerEm() {
    return this.head.unitsPerEm;
  }

  /**
   * The font’s bounding box, i.e. the box that encloses all glyphs in the font.
   * @type {BBox}
   */
  get bbox() {
    return Object.freeze(new BBox(this.head.xMin, this.head.yMin, this.head.xMax, this.head.yMax));
  }

  /**
   * @type {CmapProcessor}
   */
  get _cmapProcessor() {
    return new CmapProcessor(/** @type {CmapTable} */ (this.cmap));
  }

  /**
   * An array of all of the unicode code points supported by the font.
   * @type {number[]}
   */
  get characterSet() {
    return this._cmapProcessor.getCharacterSet();
  }

  /**
   * Returns whether there is glyph in the font for the given unicode code point.
   *
   * @param {number} codePoint
   * @return {boolean}
   */
  hasGlyphForCodePoint(codePoint) {
    return !!this._cmapProcessor.lookup(codePoint);
  }

  /**
   * Maps a single unicode code point to a Glyph object.
   * Does not perform any advanced substitutions (there is no context to do so).
   *
   * @param {number} codePoint
   * @return {Glyph | null}
   */
  glyphForCodePoint(codePoint) {
    return this.getGlyph(this._cmapProcessor.lookup(codePoint), [codePoint]);
  }

  /**
   * Returns an array of Glyph objects for the given string.
   * This is only a one-to-one mapping from characters to glyphs.
   * For most uses, you should use font.layout (described below), which
   * provides a much more advanced mapping supporting AAT and OpenType shaping.
   *
   * @param {string} string
   * @return {Glyph[]}
   */
  glyphsForString(string) {
    /** @type {Glyph[]} */
    let glyphs = [];
    let len = string.length;
    let idx = 0;
    let last = -1;
    let state = -1;

    while (idx <= len) {
      let code = 0;
      let nextState = 0;

      if (idx < len) {
        // Decode the next codepoint from UTF 16
        code = string.charCodeAt(idx++);
        if (0xd800 <= code && code <= 0xdbff && idx < len) {
          let next = string.charCodeAt(idx);
          if (0xdc00 <= next && next <= 0xdfff) {
            idx++;
            code = ((code & 0x3ff) << 10) + (next & 0x3ff) + 0x10000;
          }
        }

        // Compute the next state: 1 if the next codepoint is a variation selector, 0 otherwise.
        nextState = ((0xfe00 <= code && code <= 0xfe0f) || (0xe0100 <= code && code <= 0xe01ef)) ? 1 : 0;
      } else {
        idx++;
      }

      if (state === 0 && nextState === 1) {
        // Variation selector following normal codepoint.
        let g = this.getGlyph(this._cmapProcessor.lookup(last, code), [last, code]);
        if (g) {
          glyphs.push(g);
        }
      } else if (state === 0 && nextState === 0) {
        // Normal codepoint following normal codepoint.
        let g = this.glyphForCodePoint(last);
        if (g) {
          glyphs.push(g);
        }
      }

      last = code;
      state = nextState;
    }

    return glyphs;
  }

  /**
   * @type {LayoutEngine}
   */
  get _layoutEngine() {
    return new LayoutEngine(this);
  }

  /**
   * Returns a GlyphRun object, which includes an array of Glyphs and GlyphPositions for the given string.
   *
   * @param {string} string
   * @param {FeatureInput} [userFeatures]
   * @param {ScriptTag} [script]
   * @param {LanguageTag} [language]
   * @param {TextDirection} [direction]
   * @return {GlyphRun}
   */
  layout(string, userFeatures, script, language, direction) {
    return this._layoutEngine.layout(string, userFeatures, script, language, direction);
  }

  /**
   * Returns an array of strings that map to the given glyph id.
   * @param {number} gid - glyph id
   * @returns {string[]}
   */
  stringsForGlyph(gid) {
    return this._layoutEngine.stringsForGlyph(gid);
  }

  /**
   * An array of all [OpenType feature tags](https://www.microsoft.com/typography/otspec/featuretags.htm)
   * (or mapped AAT tags) supported by the font.
   * The features parameter is an array of OpenType feature tags to be applied in addition to the default set.
   * If this is an AAT font, the OpenType feature tags are mapped to AAT features.
   *
   * @type {string[]}
   */
  get availableFeatures() {
    return this._layoutEngine.getAvailableFeatures();
  }

  /**
   * @param {ScriptTag} [script]
   * @param {LanguageTag} [language]
   * @returns {string[]}
   */
  getAvailableFeatures(script, language) {
    return this._layoutEngine.getAvailableFeatures(script, language);
  }

  /**
   * @param {number} glyph
   * @param {number[]} [characters]
   * @returns {Glyph | null | undefined}
   */
  _getBaseGlyph(glyph, characters = []) {
    let cached = this._glyphs[glyph];
    if (cached && typeof (/** @type {{ _getContours?: unknown }} */ (cached))._getContours === 'function') {
      return cached;
    }

    /** @type {Glyph | null} */
    let outline = null;
    if (this.directory.tables.glyf) {
      outline = new TTFGlyph(glyph, characters, this);
    } else if (this.directory.tables['CFF '] || this.directory.tables.CFF2) {
      outline = new CFFGlyph(glyph, characters, this);
    }

    if (outline && !cached) {
      this._glyphs[glyph] = outline;
    }

    return outline;
  }

  /**
   * Returns a glyph object for the given glyph id.
   * You can pass the array of code points this glyph represents for
   * your use later, and it will be stored in the glyph object.
   *
   * @param {number} glyph
   * @param {number[]} [characters]
   * @return {Glyph | null}
   */
  getGlyph(glyph, characters = []) {
    if (!this._glyphs[glyph]) {
      if (this.directory.tables.sbix) {
        this._glyphs[glyph] = new SBIXGlyph(glyph, characters, this);
      } else if ((this.directory.tables.COLR) && (this.directory.tables.CPAL)) {
        this._glyphs[glyph] = new COLRGlyph(glyph, characters, this);
      } else if (this.directory.tables.CBLC || this.directory.tables.EBLC) {
        this._glyphs[glyph] = new CBDTGlyph(glyph, characters, this);
      } else {
        this._getBaseGlyph(glyph, characters);
      }
    }

    return this._glyphs[glyph] || null;
  }

  /**
   * Returns a Subset for this font.
   * @return {Subset}
   */
  createSubset() {
    if (this.directory.tables['CFF ']) {
      return new CFFSubset(this);
    }

    return new TTFSubset(this);
  }

  /**
   * Returns an object describing the available variation axes
   * that this font supports. Keys are setting tags, and values
   * contain the axis name, range, and default value.
   *
   * @type {Record<string, VariationAxisInfo>}
   */
  get variationAxes() {
    /** @type {Record<string, VariationAxisInfo>} */
    let res = {};
    if (!this.fvar) {
      return res;
    }

    for (let axis of this.fvar.axis) {
      res[axis.axisTag.trim()] = {
        name: axis.name && axis.name.en,
        min: axis.minValue,
        default: axis.defaultValue,
        max: axis.maxValue
      };
    }

    return res;
  }

  /**
   * Returns an object describing the named variation instances
   * that the font designer has specified. Keys are variation names
   * and values are the variation settings for this instance.
   *
   * @type {Record<string, Record<string, number>>}
   */
  get namedVariations() {
    /** @type {Record<string, Record<string, number>>} */
    let res = {};
    if (!this.fvar) {
      return res;
    }

    for (let instance of this.fvar.instance) {
      /** @type {Record<string, number>} */
      let settings = {};
      for (let i = 0; i < this.fvar.axis.length; i++) {
        let axis = this.fvar.axis[i];
        settings[axis.axisTag.trim()] = instance.coord[i];
      }

      let key = instance.name && instance.name.en;
      if (typeof key === 'string') {
        res[key] = settings;
      }
    }

    return res;
  }

  /**
   * Returns a new font with the given variation settings applied.
   * Settings can either be an instance name, or an object containing
   * variation tags as specified by the `variationAxes` property.
   *
   * @param {string | Record<string, number>} settings
   * @return {TTFFont}
   */
  getVariation(settings) {
    if (!(this.directory.tables.fvar && ((this.directory.tables.gvar && this.directory.tables.glyf) || this.directory.tables.CFF2))) {
      throw new Error('Variations require a font with the fvar, gvar and glyf, or CFF2 tables.');
    }

    /** @type {Record<string, number> | undefined} */
    let resolved;
    if (typeof settings === 'string') {
      resolved = this.namedVariations[settings];
    } else {
      resolved = settings;
    }

    if (typeof resolved !== 'object' || resolved == null) {
      throw new Error('Variation settings must be either a variation name or settings object.');
    }

    let fvar = /** @type {FvarTable} */ (this.fvar);

    // normalize the coordinates
    let coords = fvar.axis.map((/** @type {FvarAxis} */ axis) => {
      let axisTag = axis.axisTag.trim();
      if (axisTag in resolved) {
        return Math.max(axis.minValue, Math.min(axis.maxValue, resolved[axisTag]));
      } else {
        return axis.defaultValue;
      }
    });

    // Decompress WOFF/WOFF2 on the source once so the clone shares resolved tables.
    let maybeDecompress = /** @type {{ _decompress?: () => void }} */ (this)._decompress;
    if (typeof maybeDecompress === 'function') {
      maybeDecompress.call(this);
    }

    // Preserve subclass (WOFF/WOFF2) and share decoded state. Cached getters use a
    // WeakMap (not own enumerable props), so Object.assign skips them; we reinstall
    // table getters and clear the glyph cache for this variation instance.
    let font = Object.create(Object.getPrototypeOf(this));
    Object.assign(font, this);
    font.variationCoords = coords;
    font._glyphs = {};
    font._installTableGetters();
    return font;
  }

  /**
   * @type {GlyphVariationProcessor | null}
   */
  get _variationProcessor() {
    if (!this.fvar) {
      return null;
    }

    let variationCoords = this.variationCoords;

    // Ignore if no variation coords and not CFF2
    if (!variationCoords && !this.CFF2) {
      return null;
    }

    if (!variationCoords) {
      variationCoords = this.fvar.axis.map((/** @type {FvarAxis} */ axis) => axis.defaultValue);
    }

    return new GlyphVariationProcessor(this, variationCoords);
  }

  // Standardized format plugin API
  /**
   * @param {string | Uint8Array | Record<string, number>} name
   * @returns {TTFFont}
   */
  getFont(name) {
    return this.getVariation(/** @type {string | Record<string, number>} */ (name));
  }
}

defineCached(TTFFont.prototype, [
  'bbox',
  '_cmapProcessor',
  'characterSet',
  '_layoutEngine',
  'variationAxes',
  'namedVariations',
  '_variationProcessor'
]);

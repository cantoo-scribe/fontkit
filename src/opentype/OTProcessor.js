import GlyphIterator from './GlyphIterator';
import * as Script from '../layout/Script';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').OTLayoutTable} OTLayoutTable */
/** @typedef {import('../../types/fontkit').OTScriptRecord} OTScriptRecord */
/** @typedef {import('../../types/fontkit').OTScript} OTScript */
/** @typedef {import('../../types/fontkit').OTLangSys} OTLangSys */
/** @typedef {import('../../types/fontkit').OTFeature} OTFeature */
/** @typedef {import('../../types/fontkit').OTLookup} OTLookup */
/** @typedef {import('../../types/fontkit').FeatureLookup} FeatureLookup */
/** @typedef {import('../../types/fontkit').CoverageTable} CoverageTable */
/** @typedef {import('../../types/fontkit').ClassDefTable} ClassDefTable */
/** @typedef {import('../../types/fontkit').ContextSubtable} ContextSubtable */
/** @typedef {import('../../types/fontkit').ChainContextSubtable} ChainContextSubtable */
/** @typedef {import('../../types/fontkit').LookupRecord} LookupRecord */
/** @typedef {import('../../types/fontkit').FeatureVariationCondition} FeatureVariationCondition */
/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */
/** @typedef {import('../../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../../types/fontkit').LanguageTag} LanguageTag */
/** @typedef {import('../../types/fontkit').TextDirection} TextDirection */
/** @typedef {import('../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../types/fontkit').MarkFilteringSet} MarkFilteringSet */
/** @typedef {import('restructure').StructValue} StructValue */

const DEFAULT_SCRIPTS = ['DFLT', 'dflt', 'latn'];

export default class OTProcessor {
  /**
   * @param {LayoutFont} font
   * @param {OTLayoutTable} table
   */
  constructor(font, table) {
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {OTLayoutTable} */
    this.table = table;

    /** @type {OTScript | null} */
    this.script = null;
    /** @type {string | null} */
    this.scriptTag = null;

    /** @type {OTLangSys | null} */
    this.language = null;
    /** @type {string | null} */
    this.languageTag = null;

    /** @type {TextDirection | undefined} */
    this.direction = undefined;

    /** @type {Record<string, OTFeature>} */
    this.features = {};
    /** @type {Record<string, unknown>} */
    this.lookups = {};

    /** @type {FeatureMap | null} */
    this.userFeatures = null;

    // FeatureVariations apply at the current location; default to normalized
    // origin when no variation is set (HarfBuzz behavior). Without this,
    // variable fonts skip FeatureVariations until getVariation() is called.
    let coords = font._variationProcessor?.normalizedCoords
      ?? (font.fvar ? new Array(font.fvar.axis.length).fill(0) : null);
    /** @type {number} */
    this.variationsIndex = coords ? this.findVariationsIndex(coords) : -1;

    // initialize to default script + language
    this.selectScript();

    // current context (set by applyFeatures)
    /** @type {GlyphInfoLike[]} */
    this.glyphs = [];
    /** @type {GlyphPositionLike[] | null | undefined} */
    this.positions = []; // only used by GPOS
    /** @type {number} */
    this.ligatureID = 1;
    /** @type {string | null} */
    this.currentFeature = null;
    /** @type {GlyphIterator | undefined} */
    this.glyphIterator = undefined;
    /** @type {Map<CoverageTable, MarkFilteringSet> | undefined} */
    this._markFilteringCache = undefined;
  }

  /**
   * @param {ScriptTag | string[] | null | undefined} script
   * @returns {OTScriptRecord | null}
   */
  findScript(script) {
    if (this.table.scriptList == null) {
      return null;
    }

    /** @type {string[]} */
    let scripts;
    if (!Array.isArray(script)) {
      scripts = script == null ? [] : [script];
    } else {
      scripts = script;
    }

    for (let s of scripts) {
      for (let entry of this.table.scriptList) {
        if (entry.tag === s) {
          return entry;
        }
      }
    }

    return null;
  }

  /**
   * @param {ScriptTag | string[] | null | undefined} [script]
   * @param {LanguageTag | null | undefined} [language]
   * @param {TextDirection | null | undefined} [direction]
   * @returns {string | null}
   */
  selectScript(script, language, direction) {
    let changed = false;
    /** @type {OTScriptRecord | null | undefined} */
    let entry;
    if (!this.script || script !== this.scriptTag) {
      entry = this.findScript(script);
      if (!entry) {
        entry = this.findScript(DEFAULT_SCRIPTS);
      }

      if (!entry) {
        return this.scriptTag;
      }

      this.scriptTag = entry.tag;
      this.script = entry.script;
      this.language = null;
      this.languageTag = null;
      changed = true;
    }

    if (!direction || direction !== this.direction) {
      this.direction = direction || Script.direction(script);
    }

    if (language && language.length < 4) {
      language += ' '.repeat(4 - language.length);
    }

    if (!language || language !== this.languageTag) {
      this.language = null;

      if (this.script) {
        for (let lang of this.script.langSysRecords) {
          if (lang.tag === language) {
            this.language = lang.langSys;
            this.languageTag = lang.tag;
            break;
          }
        }

        if (!this.language) {
          this.language = this.script.defaultLangSys;
          this.languageTag = null;
        }
      }

      changed = true;
    }

    // Build a feature lookup table
    if (changed) {
      this.features = {};
      if (this.language) {
        for (let featureIndex of this.language.featureIndexes) {
          let record = this.table.featureList[featureIndex];
          let substituteFeature = this.substituteFeatureForVariations(featureIndex);
          this.features[record.tag] = substituteFeature || record.feature;
        }
      }
    }

    return this.scriptTag;
  }

  /**
   * @param {string[]} [userFeatures]
   * @param {number[] | null | undefined} [exclude]
   * @returns {FeatureLookup[]}
   */
  lookupsForFeatures(userFeatures = [], exclude) {
    /** @type {FeatureLookup[]} */
    let lookups = [];
    for (let tag of userFeatures) {
      let feature = this.features[tag];
      if (!feature) {
        continue;
      }

      for (let lookupIndex of feature.lookupListIndexes) {
        if (exclude && exclude.indexOf(lookupIndex) !== -1) {
          continue;
        }

        lookups.push({
          feature: tag,
          index: lookupIndex,
          lookup: this.table.lookupList.get(lookupIndex)
        });
      }
    }

    lookups.sort((a, b) => a.index - b.index);
    return lookups;
  }

  /**
   * @param {number} featureIndex
   * @returns {OTFeature | null}
   */
  substituteFeatureForVariations(featureIndex) {
    if (this.variationsIndex === -1) {
      return null;
    }

    let variations = this.table.featureVariations;
    if (!variations) {
      return null;
    }

    let record = variations.featureVariationRecords[this.variationsIndex];
    let substitutions = record.featureTableSubstitution.substitutions;
    for (let substitution of substitutions) {
      if (substitution.featureIndex === featureIndex) {
        return substitution.alternateFeatureTable;
      }
    }

    return null;
  }

  /**
   * @param {number[]} coords
   * @returns {number}
   */
  findVariationsIndex(coords) {
    let variations = this.table.featureVariations;
    if (!variations) {
      return -1;
    }

    let records = variations.featureVariationRecords;
    for (let i = 0; i < records.length; i++) {
      let conditions = records[i].conditionSet.conditionTable;
      if (this.variationConditionsMatch(conditions, coords)) {
        return i;
      }
    }

    return -1;
  }

  /**
   * @param {FeatureVariationCondition[]} conditions
   * @param {number[]} coords
   * @returns {boolean}
   */
  variationConditionsMatch(conditions, coords) {
    return conditions.every(/** @param {FeatureVariationCondition} condition */ (condition) => {
      let coord = condition.axisIndex < coords.length ? coords[condition.axisIndex] : 0;
      return condition.filterRangeMinValue <= coord && coord <= condition.filterRangeMaxValue;
    });
  }

  /**
   * @param {string[]} userFeatures
   * @param {GlyphInfoLike[]} glyphs
   * @param {GlyphPositionLike[] | null | undefined} [advances]
   */
  applyFeatures(userFeatures, glyphs, advances) {
    let lookups = this.lookupsForFeatures(userFeatures);
    this.applyLookups(lookups, glyphs, advances);
  }

  /**
   * @param {FeatureLookup[]} lookups
   * @param {GlyphInfoLike[]} glyphs
   * @param {GlyphPositionLike[] | null | undefined} [positions]
   */
  applyLookups(lookups, glyphs, positions) {
    this.glyphs = glyphs;
    this.positions = positions;
    this.glyphIterator = new GlyphIterator(glyphs);

    for (let { feature, lookup } of lookups) {
      this.currentFeature = feature;

      // Direction may be RTL for some lookups (see lookupDirection).
      let direction = this.lookupDirection(lookup);
      this.glyphIterator.reset(
        lookup.flags,
        direction < 0 ? glyphs.length - 1 : 0,
        this.getMarkFilteringSet(lookup)
      );

      while (this.glyphIterator.index >= 0 && this.glyphIterator.index < glyphs.length) {
        let cur = this.glyphIterator.cur;
        if (cur && feature in cur.features) {
          for (let table of lookup.subTables) {
            if (this.applyLookup(lookup.lookupType, table)) {
              break;
            }
          }
        }
        this.glyphIterator.move(direction);
      }
    }
  }

  /**
   * Subclasses may reverse iteration for specific lookup types (e.g. GSUB Type 8).
   * @param {OTLookup} _lookup
   * @returns {number}
   */
  lookupDirection(_lookup) {
    return 1;
  }

  /**
   * @param {number} _lookup
   * @param {StructValue} _table
   * @returns {boolean}
   */
  applyLookup(_lookup, _table) {
    throw new Error('applyLookup must be implemented by subclasses');
  }

  /**
   * @param {LookupRecord[]} lookupRecords
   * @returns {boolean}
   */
  applyLookupList(lookupRecords) {
    let glyphIterator = this.glyphIterator;
    if (!glyphIterator) {
      return false;
    }

    let options = glyphIterator.options;
    let markFilteringSet = glyphIterator.markFilteringSet;
    let glyphIndex = glyphIterator.index;

    for (let lookupRecord of lookupRecords) {
      // Reset flags and find glyph index for this lookup record
      glyphIterator.reset(options, glyphIndex, markFilteringSet);
      glyphIterator.increment(lookupRecord.sequenceIndex);

      // Get the lookup and setup flags for subtables
      let lookup = this.table.lookupList.get(lookupRecord.lookupListIndex);
      glyphIterator.reset(lookup.flags, glyphIterator.index, this.getMarkFilteringSet(lookup));

      // Apply lookup subtables until one matches
      for (let table of lookup.subTables) {
        if (this.applyLookup(lookup.lookupType, table)) {
          break;
        }
      }
    }

    glyphIterator.reset(options, glyphIndex, markFilteringSet);
    return true;
  }

  /**
   * @param {OTLookup} lookup
   * @returns {MarkFilteringSet | null}
   */
  getMarkFilteringSet(lookup) {
    if (!lookup.flags.flags?.useMarkFilteringSet) {
      return null;
    }

    let coverage = this.font.GDEF?.markGlyphSetsDef?.coverage?.[lookup.markFilteringSet ?? -1];
    if (!coverage) {
      return null;
    }

    // Cache a Set-like {has} that reuses coverageIndex (avoids expanding large ranges).
    let cache = (this._markFilteringCache ??= new Map());
    let filter = cache.get(coverage);
    if (!filter) {
      filter = { has: /** @param {number} id */ id => this.coverageIndex(coverage, id) >= 0 };
      cache.set(coverage, filter);
    }
    return filter;
  }

  /**
   * @param {CoverageTable} coverage
   * @param {number | null | undefined} [glyph]
   * @returns {number}
   */
  coverageIndex(coverage, glyph) {
    if (glyph == null) {
      let cur = this.glyphIterator?.cur;
      if (!cur) {
        return -1;
      }
      glyph = cur.id;
    }

    switch (coverage.version) {
      case 1:
        return coverage.glyphs ? coverage.glyphs.indexOf(glyph) : -1;

      case 2:
        if (coverage.rangeRecords) {
          for (let range of coverage.rangeRecords) {
            if (range.start <= glyph && glyph <= range.end) {
              return range.startCoverageIndex + glyph - range.start;
            }
          }
        }

        break;
    }

    return -1;
  }

  /**
   * @template T
   * @param {number} sequenceIndex
   * @param {T[]} sequence
   * @param {(component: T, glyph: GlyphInfoLike) => boolean} fn
   * @param {number[] | null | undefined} [matched]
   * @returns {boolean | number[]}
   */
  match(sequenceIndex, sequence, fn, matched) {
    let glyphIterator = this.glyphIterator;
    if (!glyphIterator) {
      return false;
    }

    let pos = glyphIterator.index;
    /** @type {GlyphInfoLike | null | undefined} */
    let glyph = glyphIterator.increment(sequenceIndex);
    let idx = 0;

    while (idx < sequence.length && glyph && fn(sequence[idx], glyph)) {
      if (matched) {
        matched.push(glyphIterator.index);
      }

      idx++;
      glyph = glyphIterator.next();
    }

    glyphIterator.index = pos;
    if (idx < sequence.length) {
      return false;
    }

    return matched || true;
  }

  /**
   * @param {number} sequenceIndex
   * @param {number[]} sequence
   * @returns {boolean | number[]}
   */
  sequenceMatches(sequenceIndex, sequence) {
    return this.match(sequenceIndex, sequence, /** @param {number} component @param {GlyphInfoLike} glyph */ (component, glyph) => component === glyph.id);
  }

  /**
   * @param {number} sequenceIndex
   * @param {number[]} sequence
   * @returns {false | number[]}
   */
  sequenceMatchIndices(sequenceIndex, sequence) {
    let result = this.match(sequenceIndex, sequence, /** @param {number} component @param {GlyphInfoLike} glyph */ (component, glyph) => {
      // If the current feature doesn't apply to this glyph,
      if (!(this.currentFeature && this.currentFeature in glyph.features)) {
        return false;
      }

      return component === glyph.id;
    }, []);
    return result === false ? false : /** @type {number[]} */ (result);
  }

  /**
   * @param {number} sequenceIndex
   * @param {CoverageTable[]} sequence
   * @returns {boolean | number[]}
   */
  coverageSequenceMatches(sequenceIndex, sequence) {
    return this.match(sequenceIndex, sequence, /** @param {CoverageTable} coverage @param {GlyphInfoLike} glyph */ (coverage, glyph) =>
      this.coverageIndex(coverage, glyph.id) >= 0
    );
  }

  /**
   * @param {number} glyph
   * @param {ClassDefTable | null | undefined} classDef
   * @returns {number}
   */
  getClassID(glyph, classDef) {
    // Offset 0 ClassDefs decode as null; treat as class 0 (OT default).
    if (!classDef) {
      return 0;
    }

    switch (classDef.version) {
      case 1: { // Class array
        let i = glyph - (classDef.startGlyph ?? 0);
        if (classDef.classValueArray && i >= 0 && i < classDef.classValueArray.length) {
          return classDef.classValueArray[i];
        }

        break;
      }

      case 2:
        if (classDef.classRangeRecord) {
          for (let range of classDef.classRangeRecord) {
            if (range.start <= glyph && glyph <= range.end) {
              return range.class;
            }
          }
        }

        break;
    }

    return 0;
  }

  /**
   * @param {number} sequenceIndex
   * @param {number[]} sequence
   * @param {ClassDefTable | null | undefined} classDef
   * @returns {boolean | number[]}
   */
  classSequenceMatches(sequenceIndex, sequence, classDef) {
    return this.match(sequenceIndex, sequence, /** @param {number} classID @param {GlyphInfoLike} glyph */ (classID, glyph) =>
      classID === this.getClassID(glyph.id, classDef)
    );
  }

  /**
   * @param {ContextSubtable | StructValue} table
   * @returns {boolean}
   */
  applyContext(table) {
    let ctx = /** @type {ContextSubtable} */ (table);
    let index;
    /** @type {import('../../types/fontkit').ContextRule[] | null | undefined} */
    let set;
    switch (ctx.version) {
      case 1:
        index = this.coverageIndex(ctx.coverage);
        if (index === -1) {
          return false;
        }

        set = ctx.ruleSets?.[index];
        if (!set) {
          return false;
        }
        for (let rule of set) {
          if (this.sequenceMatches(1, rule.input)) {
            return this.applyLookupList(rule.lookupRecords);
          }
        }

        break;

      case 2: {
        if (this.coverageIndex(ctx.coverage) === -1) {
          return false;
        }

        let cur = this.glyphIterator?.cur;
        if (!cur || !ctx.classDef) {
          return false;
        }

        index = this.getClassID(cur.id, ctx.classDef);
        set = ctx.classSet?.[index];
        if (!set) {
          return false;
        }
        for (let rule of set) {
          if (this.classSequenceMatches(1, rule.classes ?? [], ctx.classDef)) {
            return this.applyLookupList(rule.lookupRecords);
          }
        }

        break;
      }

      case 3:
        if (ctx.coverages && ctx.lookupRecords && this.coverageSequenceMatches(0, ctx.coverages)) {
          return this.applyLookupList(ctx.lookupRecords);
        }

        break;
    }

    return false;
  }

  /**
   * @param {ChainContextSubtable | StructValue} table
   * @returns {boolean}
   */
  applyChainingContext(table) {
    let ctx = /** @type {ChainContextSubtable} */ (table);
    let index;
    switch (ctx.version) {
      case 1: {
        index = this.coverageIndex(ctx.coverage);
        if (index === -1) {
          return false;
        }

        let set = ctx.chainRuleSets?.[index];
        if (!set) {
          return false;
        }
        for (let rule of set) {
          // Backtrack is stored closest-first; sequenceMatches walks furthest-first.
          if (this.sequenceMatches(-rule.backtrack.length, [...rule.backtrack].reverse())
            && this.sequenceMatches(1, rule.input)
            && this.sequenceMatches(1 + rule.input.length, rule.lookahead)) {
            return this.applyLookupList(rule.lookupRecords);
          }
        }

        break;
      }

      case 2: {
        if (this.coverageIndex(ctx.coverage) === -1) {
          return false;
        }

        let cur = this.glyphIterator?.cur;
        if (!cur || !ctx.inputClassDef) {
          return false;
        }

        index = this.getClassID(cur.id, ctx.inputClassDef);
        let rules = ctx.chainClassSet?.[index];
        if (!rules) {
          return false;
        }

        for (let rule of rules) {
          // Backtrack/lookahead ClassDefs may be NULL (offset 0) when unused.
          if (this.classSequenceMatches(-rule.backtrack.length, [...rule.backtrack].reverse(), ctx.backtrackClassDef)
            && this.classSequenceMatches(1, rule.input, ctx.inputClassDef)
            && this.classSequenceMatches(1 + rule.input.length, rule.lookahead, ctx.lookaheadClassDef)) {
            return this.applyLookupList(rule.lookupRecords);
          }
        }

        break;
      }

      case 3:
        if (ctx.backtrackCoverage && ctx.inputCoverage && ctx.lookaheadCoverage && ctx.lookupRecords
          && this.coverageSequenceMatches(-(ctx.backtrackGlyphCount ?? ctx.backtrackCoverage.length), [...ctx.backtrackCoverage].reverse())
          && this.coverageSequenceMatches(0, ctx.inputCoverage)
          && this.coverageSequenceMatches(ctx.inputGlyphCount ?? ctx.inputCoverage.length, ctx.lookaheadCoverage)) {
          return this.applyLookupList(ctx.lookupRecords);
        }

        break;
    }

    return false;
  }
}

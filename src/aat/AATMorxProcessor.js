import AATStateMachine from './AATStateMachine';
import AATLookupTable from './AATLookupTable';
import { defineCached } from '../decorators';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').LayoutGlyph} LayoutGlyph */
/** @typedef {import('../../types/fontkit').MorxTable} MorxTable */
/** @typedef {import('../../types/fontkit').MorxSubtable} MorxSubtable */
/** @typedef {import('../../types/fontkit').AATStateEntry} AATStateEntry */
/** @typedef {import('../../types/fontkit').AATFeatureSettings} AATFeatureSettings */
/** @typedef {import('../../types/fontkit').FeatureValue} FeatureValue */

// indic replacement flags
const MARK_FIRST = 0x8000;
const MARK_LAST = 0x2000;
const VERB = 0x000F;

// contextual substitution and glyph insertion flag
const SET_MARK = 0x8000;

// ligature entry flags
const SET_COMPONENT = 0x8000;
const PERFORM_ACTION = 0x2000;

// ligature action masks
const LAST_MASK = 0x80000000;
const STORE_MASK = 0x40000000;
const OFFSET_MASK = 0x3FFFFFFF;

const _VERTICAL_ONLY = 0x800000;
const REVERSE_DIRECTION = 0x400000;
const _HORIZONTAL_AND_VERTICAL = 0x200000;

// glyph insertion flags
const _CURRENT_IS_KASHIDA_LIKE = 0x2000;
const _MARKED_IS_KASHIDA_LIKE = 0x1000;
const CURRENT_INSERT_BEFORE = 0x0800;
const MARKED_INSERT_BEFORE = 0x0400;
const CURRENT_INSERT_COUNT = 0x03E0;
const MARKED_INSERT_COUNT = 0x001F;

/**
 * @typedef {[number, number]} GlyphRange
 */

export default class AATMorxProcessor {
  /**
   * @param {LayoutFont} font
   */
  constructor(font) {
    this.processIndicRearragement = this.processIndicRearragement.bind(this);
    this.processContextualSubstitution = this.processContextualSubstitution.bind(this);
    this.processLigature = this.processLigature.bind(this);
    this.processNoncontextualSubstitutions = this.processNoncontextualSubstitutions.bind(this);
    this.processGlyphInsertion = this.processGlyphInsertion.bind(this);
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {MorxTable} */
    this.morx = /** @type {MorxTable} */ (font.morx);
    /** @type {Record<number, number[][]> | null} */
    this.inputCache = null;
    /** @type {MorxSubtable | undefined} */
    this.subtable = undefined;
    /** @type {LayoutGlyph[]} */
    this.glyphs = [];
    /** @type {number[]} */
    this.ligatureStack = [];
    /** @type {number | null} */
    this.markedGlyph = null;
    /** @type {number | null} */
    this.firstGlyph = null;
    /** @type {number | null} */
    this.lastGlyph = null;
    /** @type {number | null} */
    this.markedIndex = null;
  }

  /**
   * Processes an array of glyphs and applies the specified features.
   * Features should be in the form of {featureType:{featureSetting:boolean}}
   * @param {LayoutGlyph[]} glyphs
   * @param {AATFeatureSettings | Record<number, Record<number, FeatureValue>>} [features]
   * @returns {LayoutGlyph[]}
   */
  process(glyphs, features = {}) {
    for (let chain of this.morx.chains) {
      let flags = chain.defaultFlags;

      // enable/disable the requested features
      for (let feature of chain.features) {
        let f;
        if ((f = features[feature.featureType])) {
          if (f[feature.featureSetting]) {
            flags &= feature.disableFlags;
            flags |= feature.enableFlags;
          } else if (f[feature.featureSetting] === false) {
            flags |= ~feature.disableFlags;
            flags &= ~feature.enableFlags;
          }
        }
      }

      for (let subtable of chain.subtables) {
        if (subtable.subFeatureFlags & flags) {
          this.processSubtable(subtable, glyphs);
        }
      }
    }

    // remove deleted glyphs
    let index = glyphs.length - 1;
    while (index >= 0) {
      if (glyphs[index].id === 0xffff) {
        glyphs.splice(index, 1);
      }

      index--;
    }

    return glyphs;
  }

  /**
   * @param {MorxSubtable} subtable
   * @param {LayoutGlyph[]} glyphs
   * @returns {LayoutGlyph[] | void}
   */
  processSubtable(subtable, glyphs) {
    this.subtable = subtable;
    this.glyphs = glyphs;
    if (this.subtable.type === 4) {
      this.processNoncontextualSubstitutions(this.subtable, this.glyphs);
      return;
    }

    this.ligatureStack = [];
    this.markedGlyph = null;
    this.firstGlyph = null;
    this.lastGlyph = null;
    this.markedIndex = null;

    let stateMachine = this.getStateMachine(subtable);
    let process = this.getProcessor();

    let reverse = !!(this.subtable.coverage & REVERSE_DIRECTION);
    return stateMachine.process(this.glyphs, reverse, process);
  }

  /**
   * @param {MorxSubtable} subtable
   * @returns {AATStateMachine}
   */
  getStateMachine(subtable) {
    return new AATStateMachine(/** @type {import('../../types/fontkit').AATStateTable} */ (subtable.table.stateTable));
  }

  /**
   * @returns {(glyph: LayoutGlyph | null, entry: AATStateEntry, index: number) => void}
   */
  getProcessor() {
    switch (/** @type {MorxSubtable} */ (this.subtable).type) {
      case 0:
        return this.processIndicRearragement;
      case 1:
        return this.processContextualSubstitution;
      case 2:
        return this.processLigature;
      case 5:
        return this.processGlyphInsertion;
      default:
        throw new Error(`Invalid morx subtable type: ${/** @type {MorxSubtable} */ (this.subtable).type}`);
    }
  }

  /**
   * @param {LayoutGlyph | null} glyph
   * @param {AATStateEntry} entry
   * @param {number} index
   */
  processIndicRearragement(glyph, entry, index) {
    if (entry.flags & MARK_FIRST) {
      this.firstGlyph = index;
    }

    if (entry.flags & MARK_LAST) {
      this.lastGlyph = index;
    }

    reorderGlyphs(this.glyphs, entry.flags & VERB, this.firstGlyph, this.lastGlyph);
  }

  /**
   * @param {LayoutGlyph | null} glyph
   * @param {AATStateEntry} entry
   * @param {number} index
   */
  processContextualSubstitution(glyph, entry, index) {
    let subtable = /** @type {MorxSubtable} */ (this.subtable);
    let subsitutions = subtable.table.substitutionTable.items;
    if (entry.markIndex !== 0xffff) {
      let lookup = subsitutions.getItem(/** @type {number} */ (entry.markIndex));
      let lookupTable = new AATLookupTable(lookup);
      glyph = this.glyphs[/** @type {number} */ (this.markedGlyph)];
      let gid = lookupTable.lookup(glyph.id);
      if (gid) {
        let substituted = this.font.getGlyph(gid, glyph.codePoints);
        if (substituted) {
          this.glyphs[/** @type {number} */ (this.markedGlyph)] = substituted;
        }
      }
    }

    if (entry.currentIndex !== 0xffff) {
      let lookup = subsitutions.getItem(/** @type {number} */ (entry.currentIndex));
      let lookupTable = new AATLookupTable(lookup);
      glyph = this.glyphs[index];
      let gid = lookupTable.lookup(glyph.id);
      if (gid) {
        let substituted = this.font.getGlyph(gid, glyph.codePoints);
        if (substituted) {
          this.glyphs[index] = substituted;
        }
      }
    }

    if (entry.flags & SET_MARK) {
      this.markedGlyph = index;
    }
  }

  /**
   * @param {LayoutGlyph | null} glyph
   * @param {AATStateEntry} entry
   * @param {number} index
   */
  processLigature(glyph, entry, index) {
    if (entry.flags & SET_COMPONENT) {
      this.ligatureStack.push(index);
    }

    if (entry.flags & PERFORM_ACTION) {
      let subtable = /** @type {MorxSubtable} */ (this.subtable);
      let actions = subtable.table.ligatureActions;
      let components = subtable.table.components;
      let ligatureList = subtable.table.ligatureList;

      let actionIndex = /** @type {number} */ (entry.action);
      let last = false;
      let ligatureIndex = 0;
      /** @type {number[]} */
      let codePoints = [];
      /** @type {number[]} */
      let ligatureGlyphs = [];

      while (!last) {
        let componentGlyph = this.ligatureStack.pop();
        codePoints.unshift(...this.glyphs[/** @type {number} */ (componentGlyph)].codePoints);

        let action = actions.getItem(actionIndex++);
        last = !!(action & LAST_MASK);
        let store = !!(action & STORE_MASK);
        let offset = (action & OFFSET_MASK) << 2 >> 2; // sign extend 30 to 32 bits
        offset += this.glyphs[/** @type {number} */ (componentGlyph)].id;

        let component = components.getItem(offset);
        ligatureIndex += component;

        if (last || store) {
          let ligatureEntry = ligatureList.getItem(ligatureIndex);
          let ligature = this.font.getGlyph(ligatureEntry, codePoints);
          if (ligature) {
            this.glyphs[/** @type {number} */ (componentGlyph)] = ligature;
          }
          ligatureGlyphs.push(/** @type {number} */ (componentGlyph));
          ligatureIndex = 0;
          codePoints = [];
        } else {
          let deleted = this.font.getGlyph(0xffff);
          if (deleted) {
            this.glyphs[/** @type {number} */ (componentGlyph)] = deleted;
          }
        }
      }

      // Put ligature glyph indexes back on the stack
      this.ligatureStack.push(...ligatureGlyphs);
    }
  }

  /**
   * @param {MorxSubtable} subtable
   * @param {LayoutGlyph[]} glyphs
   * @param {number} [index]
   */
  processNoncontextualSubstitutions(subtable, glyphs, index) {
    let lookupTable = new AATLookupTable(/** @type {import('../../types/fontkit').AATLookupTableData} */ (subtable.table.lookupTable));

    for (index = 0; index < glyphs.length; index++) {
      let glyph = glyphs[index];
      if (glyph.id !== 0xffff) {
        let gid = lookupTable.lookup(glyph.id);
        if (gid) { // 0 means do nothing
          let substituted = this.font.getGlyph(gid, glyph.codePoints);
          if (substituted) {
            glyphs[index] = substituted;
          }
        }
      }
    }
  }

  /**
   * @param {number} glyphIndex
   * @param {number} insertionActionIndex
   * @param {number} count
   * @param {boolean} isBefore
   */
  _insertGlyphs(glyphIndex, insertionActionIndex, count, isBefore) {
    /** @type {LayoutGlyph[]} */
    let insertions = [];
    let subtable = /** @type {MorxSubtable} */ (this.subtable);
    while (count--) {
      let gid = subtable.table.insertionActions.getItem(insertionActionIndex++);
      let inserted = this.font.getGlyph(gid);
      if (inserted) {
        insertions.push(inserted);
      }
    }

    if (!isBefore) {
      glyphIndex++;
    }

    this.glyphs.splice(glyphIndex, 0, ...insertions);
  }

  /**
   * @param {LayoutGlyph | null} glyph
   * @param {AATStateEntry} entry
   * @param {number} index
   */
  processGlyphInsertion(glyph, entry, index) {
    if (entry.flags & SET_MARK) {
      this.markedIndex = index;
    }

    if (entry.markedInsertIndex !== 0xffff) {
      let count = (entry.flags & MARKED_INSERT_COUNT) >>> 5;
      let isBefore = !!(entry.flags & MARKED_INSERT_BEFORE);
      this._insertGlyphs(/** @type {number} */ (this.markedIndex), /** @type {number} */ (entry.markedInsertIndex), count, isBefore);
    }

    if (entry.currentInsertIndex !== 0xffff) {
      let count = (entry.flags & CURRENT_INSERT_COUNT) >>> 5;
      let isBefore = !!(entry.flags & CURRENT_INSERT_BEFORE);
      this._insertGlyphs(index, /** @type {number} */ (entry.currentInsertIndex), count, isBefore);
    }
  }

  /**
   * @returns {Array<[number, number]>}
   */
  getSupportedFeatures() {
    /** @type {Array<[number, number]>} */
    let features = [];
    for (let chain of this.morx.chains) {
      for (let feature of chain.features) {
        features.push([feature.featureType, feature.featureSetting]);
      }
    }

    return features;
  }

  /**
   * @param {number} gid
   * @returns {number[][]}
   */
  generateInputs(gid) {
    if (!this.inputCache) {
      this.generateInputCache();
    }

    return /** @type {Record<number, number[][]>} */ (this.inputCache)[gid] || [];
  }

  generateInputCache() {
    this.inputCache = {};

    for (let chain of this.morx.chains) {
      let flags = chain.defaultFlags;

      for (let subtable of chain.subtables) {
        if (subtable.subFeatureFlags & flags) {
          this.generateInputsForSubtable(subtable);
        }
      }
    }
  }

  /**
   * @param {MorxSubtable} subtable
   */
  generateInputsForSubtable(subtable) {
    // Currently, only supporting ligature subtables.
    if (subtable.type !== 2) {
      return;
    }

    let reverse = !!(subtable.coverage & REVERSE_DIRECTION);
    if (reverse) {
      throw new Error('Reverse subtable, not supported.');
    }

    this.subtable = subtable;
    this.ligatureStack = [];

    let stateMachine = this.getStateMachine(subtable);
    let process = this.getProcessor();

    /** @type {LayoutGlyph[]} */
    let input = [];
    /** @type {Array<{ glyphs: LayoutGlyph[], ligatureStack: number[] }>} */
    let stack = [];
    this.glyphs = [];

    stateMachine.traverse({
      enter: (glyph, entry) => {
        let glyphs = this.glyphs;
        stack.push({
          glyphs: glyphs.slice(),
          ligatureStack: this.ligatureStack.slice()
        });

        // Add glyph to input and glyphs to process.
        let g = this.font.getGlyph(glyph);
        if (!g) {
          return;
        }
        input.push(g);
        glyphs.push(g);

        // Process ligature substitution
        process(glyphs[glyphs.length - 1], entry, glyphs.length - 1);

        // Add input to result if only one matching (non-deleted) glyph remains.
        let count = 0;
        let found = 0;
        for (let i = 0; i < glyphs.length && count <= 1; i++) {
          if (glyphs[i].id !== 0xffff) {
            count++;
            found = glyphs[i].id;
          }
        }

        if (count === 1) {
          let result = input.map(g => g.id);
          let cacheMap = /** @type {Record<number, number[][]>} */ (this.inputCache);
          let cache = cacheMap[found];
          if (cache) {
            cache.push(result);
          } else {
            cacheMap[found] = [result];
          }
        }
      },

      exit: () => {
        ({ glyphs: this.glyphs, ligatureStack: this.ligatureStack } = /** @type {{ glyphs: LayoutGlyph[], ligatureStack: number[] }} */ (stack.pop()));
        input.pop();
      }
    });
  }
}

defineCached(AATMorxProcessor.prototype, ['getStateMachine']);

/**
 * swaps the glyphs in rangeA with those in rangeB
 * reverse the glyphs inside those ranges if specified
 * ranges are in [offset, length] format
 * @param {LayoutGlyph[]} glyphs
 * @param {GlyphRange} rangeA
 * @param {GlyphRange} rangeB
 * @param {boolean} [reverseA]
 * @param {boolean} [reverseB]
 * @returns {LayoutGlyph[]}
 */
function swap(glyphs, rangeA, rangeB, reverseA = false, reverseB = false) {
  let end = glyphs.splice(rangeB[0] - (rangeB[1] - 1), rangeB[1]);
  if (reverseB) {
    end.reverse();
  }

  let start = glyphs.splice(rangeA[0], rangeA[1], ...end);
  if (reverseA) {
    start.reverse();
  }

  glyphs.splice(rangeB[0] - (rangeA[1] - 1), 0, ...start);
  return glyphs;
}

/**
 * @param {LayoutGlyph[]} glyphs
 * @param {number} verb
 * @param {number | null} firstGlyph
 * @param {number | null} lastGlyph
 * @returns {LayoutGlyph[]}
 */
function reorderGlyphs(glyphs, verb, firstGlyph, lastGlyph) {
  let first = /** @type {number} */ (firstGlyph);
  let last = /** @type {number} */ (lastGlyph);

  switch (verb) {
    case 0: // no change
      return glyphs;

    case 1: // Ax => xA
      return swap(glyphs, [first, 1], [last, 0]);

    case 2: // xD => Dx
      return swap(glyphs, [first, 0], [last, 1]);

    case 3: // AxD => DxA
      return swap(glyphs, [first, 1], [last, 1]);

    case 4: // ABx => xAB
      return swap(glyphs, [first, 2], [last, 0]);

    case 5: // ABx => xBA
      return swap(glyphs, [first, 2], [last, 0], true, false);

    case 6: // xCD => CDx
      return swap(glyphs, [first, 0], [last, 2]);

    case 7: // xCD => DCx
      return swap(glyphs, [first, 0], [last, 2], false, true);

    case 8: // AxCD => CDxA
      return swap(glyphs, [first, 1], [last, 2]);

    case 9: // AxCD => DCxA
      return swap(glyphs, [first, 1], [last, 2], false, true);

    case 10: // ABxD => DxAB
      return swap(glyphs, [first, 2], [last, 1]);

    case 11: // ABxD => DxBA
      return swap(glyphs, [first, 2], [last, 1], true, false);

    case 12: // ABxCD => CDxAB
      return swap(glyphs, [first, 2], [last, 2]);

    case 13: // ABxCD => CDxBA
      return swap(glyphs, [first, 2], [last, 2], true, false);

    case 14: // ABxCD => DCxAB
      return swap(glyphs, [first, 2], [last, 2], false, true);

    case 15: // ABxCD => DCxBA
      return swap(glyphs, [first, 2], [last, 2], true, true);

    default:
      throw new Error(`Unknown verb: ${verb}`);
  }
}

/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').GlyphIteratorOptions} GlyphIteratorOptions */
/** @typedef {import('../../types/fontkit').LookupFlags} LookupFlags */
/** @typedef {import('../../types/fontkit').MarkFilteringSet} MarkFilteringSet */

export default class GlyphIterator {
  /**
   * @param {GlyphInfoLike[]} glyphs
   * @param {GlyphIteratorOptions} [options]
   */
  constructor(glyphs, options) {
    /** @type {GlyphInfoLike[]} */
    this.glyphs = glyphs;
    this.reset(options);
  }

  /**
   * @param {GlyphIteratorOptions} [options]
   * @param {number} [index]
   * @param {MarkFilteringSet | null} [markFilteringSet]
   */
  reset(options = {}, index = 0, markFilteringSet = null) {
    /** @type {GlyphIteratorOptions} */
    this.options = options;
    /** @type {LookupFlags} */
    this.flags = options.flags || {};
    /** @type {number} */
    this.markAttachmentType = options.markAttachmentType || 0;
    /** @type {MarkFilteringSet | null} */
    this.markFilteringSet = markFilteringSet;
    /** @type {number} */
    this.index = index;
  }

  /**
   * @returns {GlyphInfoLike | null}
   */
  get cur() {
    return this.glyphs[this.index] || null;
  }

  /**
   * @param {GlyphInfoLike} glyph
   * @returns {boolean}
   */
  shouldIgnore(glyph) {
    // Mark skip hierarchy (OT chapter 2): ignoreMarks > mark filtering set > markAttachmentType.
    if (glyph.isMark) {
      if (this.flags.ignoreMarks) {
        return true;
      }
      if (this.flags.useMarkFilteringSet) {
        return !this.markFilteringSet?.has(glyph.id);
      }
      if (this.markAttachmentType) {
        return glyph.markAttachmentType !== this.markAttachmentType;
      }
    }

    return !!(this.flags.ignoreBaseGlyphs && glyph.isBase)
      || !!(this.flags.ignoreLigatures && glyph.isLigature);
  }

  /**
   * @param {number} dir
   * @returns {GlyphInfoLike | null}
   */
  move(dir) {
    this.index += dir;
    while (0 <= this.index && this.index < this.glyphs.length && this.shouldIgnore(this.glyphs[this.index])) {
      this.index += dir;
    }

    if (0 > this.index || this.index >= this.glyphs.length) {
      return null;
    }

    return this.glyphs[this.index];
  }

  /**
   * @returns {GlyphInfoLike | null}
   */
  next() {
    return this.move(+1);
  }

  /**
   * @returns {GlyphInfoLike | null}
   */
  prev() {
    return this.move(-1);
  }

  /**
   * @param {number} [count]
   * @returns {GlyphInfoLike | undefined}
   */
  peek(count = 1) {
    let idx = this.index;
    let res = this.increment(count);
    this.index = idx;
    return res;
  }

  /**
   * @param {number} [count]
   * @returns {number}
   */
  peekIndex(count = 1) {
    let idx = this.index;
    this.increment(count);
    let res = this.index;
    this.index = idx;
    return res;
  }

  /**
   * @param {number} [count]
   * @returns {GlyphInfoLike | undefined}
   */
  increment(count = 1) {
    let dir = count < 0 ? -1 : 1;
    count = Math.abs(count);
    while (count--) {
      this.move(dir);
    }

    return this.glyphs[this.index];
  }
}

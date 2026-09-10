import OTProcessor from './OTProcessor';

/** @typedef {import('../../types/fontkit').PositionValue} PositionValue */
/** @typedef {import('../../types/fontkit').AnchorPoint} AnchorPoint */
/** @typedef {import('../../types/fontkit').MarkRecord} MarkRecord */
/** @typedef {import('../../types/fontkit').CoverageTable} CoverageTable */
/** @typedef {import('../../types/fontkit').ClassDefTable} ClassDefTable */
/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */
/** @typedef {import('../../types/fontkit').ExtensionSubtable} ExtensionSubtable */
/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @typedef {StructValue & {
 *   coverage?: CoverageTable,
 *   version?: number,
 *   value?: PositionValue,
 *   values?: import('../../types/fontkit').LazyList<PositionValue>,
 *   pairSets?: import('../../types/fontkit').LazyList<Array<{ secondGlyph: number, value1: PositionValue, value2: PositionValue }>>,
 *   classDef1?: ClassDefTable,
 *   classDef2?: ClassDefTable,
 *   classRecords?: import('../../types/fontkit').LazyList<import('../../types/fontkit').LazyList<{ value1: PositionValue, value2: PositionValue }>>,
 *   entryExitRecords?: Array<{ entryAnchor?: AnchorPoint | null, exitAnchor?: AnchorPoint | null }>,
 *   markCoverage?: CoverageTable,
 *   baseCoverage?: CoverageTable,
 *   markArray?: MarkRecord[],
 *   baseArray?: AnchorPoint[][],
 *   ligatureCoverage?: CoverageTable,
 *   ligatureArray?: AnchorPoint[][][],
 *   mark1Coverage?: CoverageTable,
 *   mark2Coverage?: CoverageTable,
 *   mark1Array?: MarkRecord[],
 *   mark2Array?: AnchorPoint[][],
 *   lookupType?: number,
 *   extension?: StructValue,
 * }} GPOSSubtable
 */

export default class GPOSProcessor extends OTProcessor {
  /**
   * @param {number} sequenceIndex
   * @param {PositionValue} value
   */
  applyPositionValue(sequenceIndex, value) {
    let glyphIterator = this.glyphIterator;
    if (!glyphIterator || !this.positions) {
      return;
    }

    let position = this.positions[glyphIterator.peekIndex(sequenceIndex)];
    if (!position) {
      return;
    }

    if (value.xAdvance != null) position.xAdvance += value.xAdvance;
    if (value.yAdvance != null) position.yAdvance += value.yAdvance;
    if (value.xPlacement != null) position.xOffset += value.xPlacement;
    if (value.yPlacement != null) position.yOffset += value.yPlacement;

    // Adjustments for font variations
    let variationProcessor = this.font._variationProcessor;
    let variationStore = this.font.GDEF && this.font.GDEF.itemVariationStore;
    if (variationProcessor && variationStore) {
      if (value.xPlaDevice) {
        position.xOffset += variationProcessor.getDelta(variationStore, value.xPlaDevice.a, value.xPlaDevice.b);
      }

      if (value.yPlaDevice) {
        position.yOffset += variationProcessor.getDelta(variationStore, value.yPlaDevice.a, value.yPlaDevice.b);
      }

      if (value.xAdvDevice) {
        position.xAdvance += variationProcessor.getDelta(variationStore, value.xAdvDevice.a, value.xAdvDevice.b);
      }

      if (value.yAdvDevice) {
        position.yAdvance += variationProcessor.getDelta(variationStore, value.yAdvDevice.a, value.yAdvDevice.b);
      }
    }

    // TODO: device tables
  }

  /**
   * @param {number} lookupType
   * @param {StructValue} table
   * @returns {boolean}
   */
  applyLookup(lookupType, table) {
    let t = /** @type {GPOSSubtable} */ (table);
    let glyphIterator = this.glyphIterator;
    if (!glyphIterator) {
      return false;
    }

    switch (lookupType) {
      case 1: { // Single positioning value
        if (!t.coverage) return false;
        let index = this.coverageIndex(t.coverage);
        if (index === -1) return false;

        switch (t.version) {
          case 1:
            if (t.value) this.applyPositionValue(0, t.value);
            break;

          case 2:
            if (t.values) this.applyPositionValue(0, t.values.get(index));
            break;
        }

        return true;
      }

      case 2: { // Pair Adjustment Positioning
        let nextGlyph = glyphIterator.peek();
        if (!nextGlyph) return false;

        if (!t.coverage) return false;
        let index = this.coverageIndex(t.coverage);
        if (index === -1) return false;

        switch (t.version) {
          case 1: { // Adjustments for glyph pairs
            if (!t.pairSets) return false;
            let set = t.pairSets.get(index);

            for (let pair of set) {
              if (pair.secondGlyph === nextGlyph.id) {
                this.applyPositionValue(0, pair.value1);
                this.applyPositionValue(1, pair.value2);
                return true;
              }
            }

            return false;
          }

          case 2: { // Class pair adjustment
            let cur = glyphIterator.cur;
            if (!cur || !t.classDef1 || !t.classDef2 || !t.classRecords) return false;

            let class1 = this.getClassID(cur.id, t.classDef1);
            let class2 = this.getClassID(nextGlyph.id, t.classDef2);
            if (class1 === -1 || class2 === -1) return false;

            let pair = t.classRecords.get(class1).get(class2);
            this.applyPositionValue(0, pair.value1);
            this.applyPositionValue(1, pair.value2);
            return true;
          }
        }

        return false;
      }

      case 3: { // Cursive Attachment Positioning
        if (!t.coverage || !t.entryExitRecords || !this.positions) return false;

        let nextIndex = glyphIterator.peekIndex();
        let nextGlyph = this.glyphs[nextIndex];
        if (!nextGlyph) return false;

        let curRecord = t.entryExitRecords[this.coverageIndex(t.coverage)];
        if (!curRecord || !curRecord.exitAnchor) return false;

        let nextRecord = t.entryExitRecords[this.coverageIndex(t.coverage, nextGlyph.id)];
        if (!nextRecord || !nextRecord.entryAnchor) return false;

        let entry = this.getAnchor(nextRecord.entryAnchor);
        let exit = this.getAnchor(curRecord.exitAnchor);

        let cur = this.positions[glyphIterator.index];
        let next = this.positions[nextIndex];
        if (!cur || !next) return false;
        let d;

        switch (this.direction) {
          case 'ltr':
            cur.xAdvance = exit.x + cur.xOffset;

            d = entry.x + next.xOffset;
            next.xAdvance -= d;
            next.xOffset -= d;
            break;

          case 'rtl':
            d = exit.x + cur.xOffset;
            cur.xAdvance -= d;
            cur.xOffset -= d;
            next.xAdvance = entry.x + next.xOffset;
            break;
        }

        let curGlyph = glyphIterator.cur;
        if (!curGlyph) return false;

        if (glyphIterator.flags.rightToLeft) {
          curGlyph.cursiveAttachment = nextIndex;
          cur.yOffset = entry.y - exit.y;
        } else {
          nextGlyph.cursiveAttachment = glyphIterator.index;
          cur.yOffset = exit.y - entry.y;
        }

        return true;
      }

      case 4: { // Mark to base positioning
        if (!t.markCoverage || !t.baseCoverage || !t.markArray || !t.baseArray) return false;

        let markIndex = this.coverageIndex(t.markCoverage);
        if (markIndex === -1) return false;

        // search backward for a base glyph
        let baseGlyphIndex = glyphIterator.index;
        while (--baseGlyphIndex >= 0 && (this.glyphs[baseGlyphIndex].isMark || (this.glyphs[baseGlyphIndex].ligatureComponent ?? 0) > 0));

        if (baseGlyphIndex < 0) return false;

        let baseIndex = this.coverageIndex(t.baseCoverage, this.glyphs[baseGlyphIndex].id);
        if (baseIndex === -1) return false;

        let markRecord = t.markArray[markIndex];
        let baseAnchor = t.baseArray[baseIndex][markRecord.class];
        return this.applyAnchor(markRecord, baseAnchor, baseGlyphIndex);
      }

      case 5: { // Mark to ligature positioning
        if (!t.markCoverage || !t.ligatureCoverage || !t.markArray || !t.ligatureArray) return false;

        let markIndex = this.coverageIndex(t.markCoverage);
        if (markIndex === -1) return false;

        // search backward for a base glyph
        let baseGlyphIndex = glyphIterator.index;
        while (--baseGlyphIndex >= 0 && this.glyphs[baseGlyphIndex].isMark);

        if (baseGlyphIndex < 0) return false;

        let ligIndex = this.coverageIndex(t.ligatureCoverage, this.glyphs[baseGlyphIndex].id);
        if (ligIndex === -1) return false;

        let ligAttach = t.ligatureArray[ligIndex];
        let markGlyph = glyphIterator.cur;
        let ligGlyph = this.glyphs[baseGlyphIndex];
        if (!markGlyph) return false;

        let compIndex = ligGlyph.ligatureID && ligGlyph.ligatureID === markGlyph.ligatureID && (markGlyph.ligatureComponent ?? 0) > 0
          ? Math.min(markGlyph.ligatureComponent ?? 0, ligGlyph.codePoints.length) - 1
          : ligGlyph.codePoints.length - 1;

        let markRecord = t.markArray[markIndex];
        let baseAnchor = ligAttach[compIndex][markRecord.class];
        return this.applyAnchor(markRecord, baseAnchor, baseGlyphIndex);
      }

      case 6: { // Mark to mark positioning
        if (!t.mark1Coverage || !t.mark2Coverage || !t.mark1Array || !t.mark2Array) return false;

        let mark1Index = this.coverageIndex(t.mark1Coverage);
        if (mark1Index === -1) return false;

        // get the previous mark to attach to
        let prevIndex = glyphIterator.peekIndex(-1);
        let prev = this.glyphs[prevIndex];
        if (!prev || !prev.isMark) return false;

        let cur = glyphIterator.cur;
        if (!cur) return false;

        // The following logic was borrowed from Harfbuzz
        let good = false;
        if (cur.ligatureID === prev.ligatureID) {
          if (!cur.ligatureID) { // Marks belonging to the same base
            good = true;
          } else if (cur.ligatureComponent === prev.ligatureComponent) { // Marks belonging to the same ligature component
            good = true;
          }
        } else {
          // If ligature ids don't match, it may be the case that one of the marks
          // itself is a ligature, in which case match.
          if ((cur.ligatureID && !cur.ligatureComponent) || (prev.ligatureID && !prev.ligatureComponent)) {
            good = true;
          }
        }

        if (!good) return false;

        let mark2Index = this.coverageIndex(t.mark2Coverage, prev.id);
        if (mark2Index === -1) return false;

        let markRecord = t.mark1Array[mark1Index];
        let baseAnchor = t.mark2Array[mark2Index][markRecord.class];
        return this.applyAnchor(markRecord, baseAnchor, prevIndex);
      }

      case 7: // Contextual positioning
        return this.applyContext(table);

      case 8: // Chaining contextual positioning
        return this.applyChainingContext(table);

      case 9: { // Extension positioning
        let ext = /** @type {ExtensionSubtable} */ (table);
        return this.applyLookup(ext.lookupType, ext.extension);
      }

      default:
        throw new Error(`Unsupported GPOS table: ${lookupType}`);
    }
  }

  /**
   * @param {MarkRecord} markRecord
   * @param {AnchorPoint | null | undefined} baseAnchor
   * @param {number} baseGlyphIndex
   * @returns {boolean}
   */
  applyAnchor(markRecord, baseAnchor, baseGlyphIndex) {
    // NULL offset = no anchor for this class; false so later subtables can try (HarfBuzz).
    if (!baseAnchor || !markRecord.markAnchor) return false;

    let glyphIterator = this.glyphIterator;
    if (!glyphIterator || !this.positions) return false;

    let baseCoords = this.getAnchor(baseAnchor);
    let markCoords = this.getAnchor(markRecord.markAnchor);
    let markPos = this.positions[glyphIterator.index];
    if (!markPos) return false;

    markPos.xOffset = baseCoords.x - markCoords.x;
    markPos.yOffset = baseCoords.y - markCoords.y;
    let cur = glyphIterator.cur;
    if (!cur) return false;
    cur.markAttachment = baseGlyphIndex;
    return true;
  }

  /**
   * @param {AnchorPoint} anchor
   * @returns {{ x: number, y: number }}
   */
  getAnchor(anchor) {
    // TODO: contour point, device tables
    let x = anchor.xCoordinate;
    let y = anchor.yCoordinate;

    // Adjustments for font variations
    let variationProcessor = this.font._variationProcessor;
    let variationStore = this.font.GDEF && this.font.GDEF.itemVariationStore;
    if (variationProcessor && variationStore) {
      if (anchor.xDeviceTable) {
        x += variationProcessor.getDelta(variationStore, anchor.xDeviceTable.a, anchor.xDeviceTable.b);
      }

      if (anchor.yDeviceTable) {
        y += variationProcessor.getDelta(variationStore, anchor.yDeviceTable.a, anchor.yDeviceTable.b);
      }
    }

    return { x, y };
  }

  /**
   * @param {string[]} userFeatures
   * @param {GlyphInfoLike[]} glyphs
   * @param {GlyphPositionLike[] | null | undefined} [advances]
   */
  applyFeatures(userFeatures, glyphs, advances) {
    super.applyFeatures(userFeatures, glyphs, advances);

    for (let i = 0; i < this.glyphs.length; i++) {
      this.fixCursiveAttachment(i);
    }

    this.fixMarkAttachment();
  }

  /**
   * @param {number} i
   */
  fixCursiveAttachment(i) {
    let glyph = this.glyphs[i];
    if (glyph.cursiveAttachment != null && this.positions) {
      let j = glyph.cursiveAttachment;

      glyph.cursiveAttachment = null;
      this.fixCursiveAttachment(j);

      this.positions[i].yOffset += this.positions[j].yOffset;
    }
  }

  fixMarkAttachment() {
    if (!this.positions) {
      return;
    }

    for (let i = 0; i < this.glyphs.length; i++) {
      let glyph = this.glyphs[i];
      if (glyph.markAttachment != null) {
        let j = glyph.markAttachment;

        this.positions[i].xOffset += this.positions[j].xOffset;
        this.positions[i].yOffset += this.positions[j].yOffset;

        if (this.direction === 'ltr') {
          for (let k = j; k < i; k++) {
            this.positions[i].xOffset -= this.positions[k].xAdvance;
            this.positions[i].yOffset -= this.positions[k].yAdvance;
          }
        } else {
          for (let k = j + 1; k < i + 1; k++) {
            this.positions[i].xOffset += this.positions[k].xAdvance;
            this.positions[i].yOffset += this.positions[k].yAdvance;
          }
        }
      }
    }
  }
}

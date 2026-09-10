import { isMark } from '../packages/unicode-properties/index.js';
import OTProcessor from './OTProcessor';

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../types/fontkit').FeatureInput} FeatureInput */
/** @typedef {import('../../types/fontkit').ClassDefTable} ClassDefTable */

export default class GlyphInfo {
  /**
   * @param {LayoutFont} font
   * @param {number} id
   * @param {number[]} [codePoints]
   * @param {FeatureInput | null | undefined} [features]
   */
  constructor(font, id, codePoints = [], features) {
    /** @type {LayoutFont} */
    this._font = font;
    /** @type {number[]} */
    this.codePoints = codePoints;
    /** @type {number} */
    this._id = 0;

    /** @type {FeatureMap} */
    this.features = {};
    if (Array.isArray(features)) {
      for (let i = 0; i < features.length; i++) {
        let feature = features[i];
        this.features[feature] = true;
      }
    } else if (typeof features === 'object' && features !== null) {
      Object.assign(this.features, features);
    }

    /** @type {number | null} */
    this.ligatureID = null;
    /** @type {number | null} */
    this.ligatureComponent = null;
    /** @type {boolean} */
    this.isLigated = false;
    /** @type {number | null} */
    this.cursiveAttachment = null;
    /** @type {number | null} */
    this.markAttachment = null;
    /** @type {import('../../types/fontkit').IndicShaperInfo | import('../../types/fontkit').USEShaperInfo | null} */
    this.shaperInfo = null;
    /** @type {boolean} */
    this.substituted = false;
    /** @type {boolean} */
    this.isMultiplied = false;

    /** @type {boolean} */
    this.isBase = false;
    /** @type {boolean} */
    this.isLigature = false;
    /** @type {boolean} */
    this.isMark = false;
    /** @type {number} */
    this.markAttachmentType = 0;

    // Apply GDEF / mark classification via the id setter, then clear
    // `substituted` — construction is not a GSUB substitution.
    this.id = id;
    this.substituted = false;
  }

  /**
   * @returns {number}
   */
  get id() {
    return this._id;
  }

  /**
   * @param {number} id
   */
  set id(id) {
    this._id = id;
    this.substituted = true;

    let GDEF = this._font.GDEF;
    if (GDEF && GDEF.glyphClassDef) {
      // TODO: clean this up
      let classID = OTProcessor.prototype.getClassID(id, /** @type {ClassDefTable} */ (GDEF.glyphClassDef));
      this.isBase = classID === 1;
      this.isLigature = classID === 2;
      this.isMark = classID === 3;
      this.markAttachmentType = GDEF.markAttachClassDef
        ? OTProcessor.prototype.getClassID(id, /** @type {ClassDefTable} */ (GDEF.markAttachClassDef))
        : 0;
    } else {
      this.isMark = this.codePoints.length > 0 && this.codePoints.every(isMark);
      this.isBase = !this.isMark;
      this.isLigature = this.codePoints.length > 1;
      this.markAttachmentType = 0;
    }
  }

  /**
   * @returns {GlyphInfo}
   */
  copy() {
    return new GlyphInfo(this._font, this.id, this.codePoints, this.features);
  }
}

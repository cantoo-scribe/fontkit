/**
 * ShapingPlans are used by the OpenType shapers to store which
 * features should by applied, and in what order to apply them.
 * The features are applied in groups called stages. A feature
 * can be applied globally to all glyphs, or locally to only
 * specific glyphs.
 *
 * @private
 */

/** @typedef {import('../../types/fontkit').LayoutFont} LayoutFont */
/** @typedef {import('../../types/fontkit').ScriptTag} ScriptTag */
/** @typedef {import('../../types/fontkit').TextDirection} TextDirection */
/** @typedef {import('../../types/fontkit').FeatureMap} FeatureMap */
/** @typedef {import('../../types/fontkit').FeatureInput} FeatureInput */
/** @typedef {import('../../types/fontkit').GlyphInfoLike} GlyphInfoLike */
/** @typedef {import('../../types/fontkit').GlyphPositionLike} GlyphPositionLike */
/** @typedef {import('../../types/fontkit').ShapingStage} ShapingStage */
/** @typedef {import('../../types/fontkit').ShapingStageFn} ShapingStageFn */
/** @typedef {import('./OTProcessor').default} OTProcessor */

/**
 * @typedef {{ global?: string[], local?: string[] }} FeatureStagesArg
 */

export default class ShapingPlan {
  /**
   * @param {LayoutFont} font
   * @param {ScriptTag | string[] | null | undefined} script
   * @param {TextDirection} direction
   */
  constructor(font, script, direction) {
    /** @type {LayoutFont} */
    this.font = font;
    /** @type {ScriptTag | string[] | null | undefined} */
    this.script = script;
    /** @type {TextDirection} */
    this.direction = direction;
    /** @type {ShapingStage[]} */
    this.stages = [];
    /** @type {FeatureMap} */
    this.globalFeatures = {};
    /** @type {Record<string, number>} */
    this.allFeatures = {};
    /** @type {FeatureMap | null} */
    this.userFeatures = null; // original user feature values (for Type 3 alternate index)
    /** @type {ScriptTag | string[] | null | undefined} */
    this.bufferScript = undefined;
  }

  /**
   * Adds the given features to the last stage.
   * Already-planned tags are not duplicated, but a global add still promotes them.
   * @param {string[]} features
   * @param {boolean} global
   */
  _addFeatures(features, global) {
    let stageIndex = this.stages.length - 1;
    let stage = this.stages[stageIndex];
    if (!Array.isArray(stage)) {
      return;
    }
    for (let feature of features) {
      if (this.allFeatures[feature] == null) {
        stage.push(feature);
        this.allFeatures[feature] = stageIndex;
      }

      if (global) {
        this.globalFeatures[feature] = true;
      }
    }
  }

  /**
   * Add features to the last stage
   * @param {string | string[] | FeatureStagesArg} arg
   * @param {boolean} [global]
   */
  add(arg, global = true) {
    if (this.stages.length === 0) {
      this.stages.push([]);
    }

    if (typeof arg === 'string') {
      arg = [arg];
    }

    if (Array.isArray(arg)) {
      this._addFeatures(arg, global);
    } else if (typeof arg === 'object' && arg !== null) {
      this._addFeatures(arg.global || [], true);
      this._addFeatures(arg.local || [], false);
    } else {
      throw new Error('Unsupported argument to ShapingPlan#add');
    }
  }

  /**
   * Add a new stage
   * @param {string | string[] | FeatureStagesArg | ShapingStageFn} arg
   * @param {boolean} [global]
   */
  addStage(arg, global) {
    if (typeof arg === 'function') {
      this.stages.push(arg, []);
    } else {
      this.stages.push([]);
      this.add(arg, global);
    }
  }

  /**
   * @param {FeatureInput | null | undefined} features
   */
  setFeatureOverrides(features) {
    if (Array.isArray(features)) {
      this.add(features);
    } else if (typeof features === 'object' && features !== null) {
      this.userFeatures = features;
      for (let tag in features) {
        if (features[tag]) {
          this.add(tag);
        } else if (this.allFeatures[tag] != null) {
          let stage = this.stages[this.allFeatures[tag]];
          if (Array.isArray(stage)) {
            stage.splice(stage.indexOf(tag), 1);
          }
          delete this.allFeatures[tag];
          delete this.globalFeatures[tag];
        }
      }
    }
  }

  /**
   * Assigns the global features to the given glyphs
   * @param {GlyphInfoLike[]} glyphs
   */
  assignGlobalFeatures(glyphs) {
    for (let glyph of glyphs) {
      for (let feature in this.globalFeatures) {
        glyph.features[feature] = true;
      }
    }
  }

  /**
   * Executes the planned stages using the given OTProcessor
   * @param {OTProcessor} processor
   * @param {GlyphInfoLike[]} glyphs
   * @param {GlyphPositionLike[] | null | undefined} [positions]
   */
  process(processor, glyphs, positions) {
    // Preserve original user values (e.g. { aalt: 2 }) for GSUB Type 3.
    processor.userFeatures = this.userFeatures;

    for (let stage of this.stages) {
      if (typeof stage === 'function') {
        if (!positions) {
          stage(this.font, glyphs, this);
        }
      } else if (stage.length > 0) {
        processor.applyFeatures(stage, glyphs, positions);
      }
    }
  }
}

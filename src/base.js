import { DecodeStream } from 'restructure';

/** @typedef {import('../types/fontkit').FontFormat} FontFormat */
/** @typedef {import('../types/fontkit').OpenedFont} OpenedFont */

export let logErrors = false;

/** @type {FontFormat[]} */
let formats = [];

/**
 * @param {FontFormat} format
 * @returns {void}
 */
export function registerFormat(format) {
  formats.push(format);
};

/**
 * @param {ArrayBufferView} buffer
 * @param {string | Uint8Array} [postscriptName]
 * @returns {OpenedFont | null | undefined}
 */
export function create(buffer, postscriptName) {
  for (let i = 0; i < formats.length; i++) {
    let format = formats[i];
    if (format.probe(buffer)) {
      let font = new format(new DecodeStream(buffer));
      if (postscriptName) {
        return font.getFont(postscriptName);
      }

      return font;
    }
  }

  throw new Error('Unknown font format');
};

export let defaultLanguage = 'en';

/**
 * @param {string} [lang]
 * @returns {void}
 */
export function setDefaultLanguage(lang = 'en') {
  defaultLanguage = lang;
};

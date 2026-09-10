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

/**
 * Default-export namespace (live bindings for mutable flags).
 * Consumers can use either `import * as fontkit` or `import fontkit from`.
 * @type {{
 *   logErrors: boolean,
 *   defaultLanguage: string,
 *   registerFormat: typeof registerFormat,
 *   create: typeof create,
 *   setDefaultLanguage: typeof setDefaultLanguage,
 *   open?: typeof import('./fs.js').open,
 *   openSync?: typeof import('./fs.js').openSync
 * }}
 */
const fontkit = {
  get logErrors() {
    return logErrors;
  },
  set logErrors(value) {
    logErrors = value;
  },
  get defaultLanguage() {
    return defaultLanguage;
  },
  set defaultLanguage(value) {
    defaultLanguage = value;
  },
  registerFormat,
  create,
  setDefaultLanguage
};

export default fontkit;

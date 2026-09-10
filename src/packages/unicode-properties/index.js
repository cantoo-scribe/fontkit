import UnicodeTrie from '../unicode-trie/index.js';
import data from './data.js';
import trieBase64 from './data-trie.js';

/**
 * @param {string} base64
 * @returns {Uint8Array}
 */
function decodeBase64(base64) {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const trie = new UnicodeTrie(decodeBase64(trieBase64));

/** @type {(n: number) => number} */
const log2 = Math.log2 || (n => Math.log(n) / Math.LN2);
/**
 * @param {number} n
 * @returns {number}
 */
const bits = n => ((log2(n) + 1) | 0);

// compute the number of bits stored for each field
const CATEGORY_BITS = bits(data.categories.length - 1);
const COMBINING_BITS = bits(data.combiningClasses.length - 1);
const SCRIPT_BITS = bits(data.scripts.length - 1);
const EAW_BITS = bits(data.eaw.length - 1);
const NUMBER_BITS = 10;

// compute shift and mask values for each field
const CATEGORY_SHIFT = COMBINING_BITS + SCRIPT_BITS + EAW_BITS + NUMBER_BITS;
const COMBINING_SHIFT = SCRIPT_BITS + EAW_BITS + NUMBER_BITS;
const SCRIPT_SHIFT = EAW_BITS + NUMBER_BITS;
const EAW_SHIFT = NUMBER_BITS;
const CATEGORY_MASK = (1 << CATEGORY_BITS) - 1;
const COMBINING_MASK = (1 << COMBINING_BITS) - 1;
const SCRIPT_MASK = (1 << SCRIPT_BITS) - 1;
const EAW_MASK = (1 << EAW_BITS) - 1;
const NUMBER_MASK = (1 << NUMBER_BITS) - 1;

/**
 * @param {number} codePoint
 * @returns {string}
 */
export function getCategory(codePoint) {
  const val = trie.get(codePoint);
  return data.categories[(val >> CATEGORY_SHIFT) & CATEGORY_MASK];
}

/**
 * @param {number} codePoint
 * @returns {string}
 */
export function getCombiningClass(codePoint) {
  const val = trie.get(codePoint);
  return data.combiningClasses[(val >> COMBINING_SHIFT) & COMBINING_MASK];
}

/**
 * @param {number} codePoint
 * @returns {string}
 */
export function getScript(codePoint) {
  const val = trie.get(codePoint);
  return data.scripts[(val >> SCRIPT_SHIFT) & SCRIPT_MASK];
}

/**
 * @param {number} codePoint
 * @returns {string}
 */
export function getEastAsianWidth(codePoint) {
  const val = trie.get(codePoint);
  return data.eaw[(val >> EAW_SHIFT) & EAW_MASK];
}

/**
 * @param {number} codePoint
 * @returns {number | null}
 */
export function getNumericValue(codePoint) {
  let val = trie.get(codePoint);
  let num = val & NUMBER_MASK;

  if (num === 0) {
    return null;
  } else if (num <= 50) {
    return num - 1;
  } else if (num < 0x1e0) {
    const numerator = (num >> 4) - 12;
    const denominator = (num & 0xf) + 1;
    return numerator / denominator;
  } else if (num < 0x300) {
    val = (num >> 5) - 14;
    let exp = (num & 0x1f) + 2;

    while (exp > 0) {
      val *= 10;
      exp--;
    }
    return val;
  } else {
    val = (num >> 2) - 0xbf;
    let exp = (num & 3) + 1;
    while (exp > 0) {
      val *= 60;
      exp--;
    }
    return val;
  }
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isAlphabetic(codePoint) {
  const category = getCategory(codePoint);
  return (
    category === 'Lu'
    || category === 'Ll'
    || category === 'Lt'
    || category === 'Lm'
    || category === 'Lo'
    || category === 'Nl'
  );
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isDigit(codePoint) {
  return getCategory(codePoint) === 'Nd';
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isPunctuation(codePoint) {
  const category = getCategory(codePoint);
  return (
    category === 'Pc'
    || category === 'Pd'
    || category === 'Pe'
    || category === 'Pf'
    || category === 'Pi'
    || category === 'Po'
    || category === 'Ps'
  );
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isLowerCase(codePoint) {
  return getCategory(codePoint) === 'Ll';
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isUpperCase(codePoint) {
  return getCategory(codePoint) === 'Lu';
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isTitleCase(codePoint) {
  return getCategory(codePoint) === 'Lt';
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isWhiteSpace(codePoint) {
  const category = getCategory(codePoint);
  return (
    category === 'Zs'
    || category === 'Zl'
    || category === 'Zp'
  );
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isBaseForm(codePoint) {
  const category = getCategory(codePoint);
  return (
    category === 'Nd'
    || category === 'No'
    || category === 'Nl'
    || category === 'Lu'
    || category === 'Ll'
    || category === 'Lt'
    || category === 'Lm'
    || category === 'Lo'
    || category === 'Me'
    || category === 'Mc'
  );
}

/**
 * @param {number} codePoint
 * @returns {boolean}
 */
export function isMark(codePoint) {
  const category = getCategory(codePoint);
  return (
    category === 'Mn'
    || category === 'Me'
    || category === 'Mc'
  );
}

// Backwards compatibility.
export default {
  getCategory,
  getCombiningClass,
  getScript,
  getEastAsianWidth,
  getNumericValue,
  isAlphabetic,
  isDigit,
  isPunctuation,
  isLowerCase,
  isUpperCase,
  isTitleCase,
  isWhiteSpace,
  isBaseForm,
  isMark
};

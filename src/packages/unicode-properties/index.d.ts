/**
 * Public TypeScript API for `@cantoo/unicode-properties`.
 */

export function getCategory(codePoint: number): string;
export function getCombiningClass(codePoint: number): string;
export function getScript(codePoint: number): string;
export function getEastAsianWidth(codePoint: number): string;
export function getNumericValue(codePoint: number): number | null;
export function isAlphabetic(codePoint: number): boolean;
export function isDigit(codePoint: number): boolean;
export function isPunctuation(codePoint: number): boolean;
export function isLowerCase(codePoint: number): boolean;
export function isUpperCase(codePoint: number): boolean;
export function isTitleCase(codePoint: number): boolean;
export function isWhiteSpace(codePoint: number): boolean;
export function isBaseForm(codePoint: number): boolean;
export function isMark(codePoint: number): boolean;

declare const unicodeProperties: {
  getCategory: typeof getCategory;
  getCombiningClass: typeof getCombiningClass;
  getScript: typeof getScript;
  getEastAsianWidth: typeof getEastAsianWidth;
  getNumericValue: typeof getNumericValue;
  isAlphabetic: typeof isAlphabetic;
  isDigit: typeof isDigit;
  isPunctuation: typeof isPunctuation;
  isLowerCase: typeof isLowerCase;
  isUpperCase: typeof isUpperCase;
  isTitleCase: typeof isTitleCase;
  isWhiteSpace: typeof isWhiteSpace;
  isBaseForm: typeof isBaseForm;
  isMark: typeof isMark;
};

export default unicodeProperties;

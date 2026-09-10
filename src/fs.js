import { create } from './base';
import fs from 'fs';

/**
 * @param {string | import('fs').PathLike} filename
 * @param {string | Uint8Array} [postscriptName]
 * @returns {import('../types/fontkit').OpenedFont | null | undefined}
 */
export function openSync(filename, postscriptName) {
  let buffer = fs.readFileSync(filename);
  return create(buffer, postscriptName);
}

/**
 * @param {string | import('fs').PathLike} filename
 * @param {string | Uint8Array} [postscriptName]
 * @returns {Promise<import('../types/fontkit').OpenedFont | null | undefined>}
 */
export async function open(filename, postscriptName) {
  let buffer = await fs.promises.readFile(filename);
  return create(buffer, postscriptName);
}

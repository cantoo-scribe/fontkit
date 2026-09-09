import { create } from './base';
import fs from 'fs';

export function openSync(filename, postscriptName) {
  let buffer = fs.readFileSync(filename);
  return create(buffer, postscriptName);
}

export async function open(filename, postscriptName) {
  let buffer = await fs.promises.readFile(filename);
  return create(buffer, postscriptName);
}

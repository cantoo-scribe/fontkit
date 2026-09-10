import Glyph from './Glyph';
import Path from './Path';
import { StandardEncoding } from '../cff/CFFEncodings';

/** @typedef {import('../../types/fontkit').CFFCharString} CFFCharString */
/** @typedef {import('../../types/fontkit').CFFFontLike} CFFFontLike */
/** @typedef {import('../../types/fontkit').GlyphLike} GlyphLike */
/** @typedef {import('../../types/fontkit').ItemVariationStore} ItemVariationStore */

/**
 * @param {unknown} value
 * @returns {value is CFFCharString}
 */
function isCFFCharString(value) {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  let offset = Reflect.get(value, 'offset');
  let length = Reflect.get(value, 'length');
  return typeof offset === 'number' && typeof length === 'number';
}

/**
 * Represents an OpenType PostScript glyph, in the Compact Font Format.
 */
export default class CFFGlyph extends Glyph {
  type = 'CFF';

  /**
   * Subroutines used while decoding; set during `_getPath`.
   * @type {Record<number, boolean> | undefined}
   */
  _usedGsubrs;

  /**
   * Local subroutines used while decoding; set during `_getPath`.
   * @type {Record<number, boolean> | undefined}
   */
  _usedSubrs;

  /**
   * @returns {string | null | undefined}
   */
  _getName() {
    if (this._font.CFF2) {
      return super._getName();
    }

    let cff = this._font['CFF '];
    if (!cff || typeof cff.getGlyphName !== 'function') {
      return null;
    }
    return cff.getGlyphName(this.id);
  }

  /**
   * @param {{ length: number }} s
   * @returns {number}
   */
  bias(s) {
    if (s.length < 1240) {
      return 107;
    } else if (s.length < 33900) {
      return 1131;
    } else {
      return 32768;
    }
  }

  /**
   * @returns {Path}
   */
  _getPath() {
    let cff = this._font.CFF2 || this._font['CFF '];
    if (!cff) {
      return new Path();
    }
    /** @type {CFFFontLike} */
    let cffFont = cff;
    let { stream } = cffFont;
    let rawStr = cffFont.topDict.CharStrings[this.id];
    if (!isCFFCharString(rawStr)) {
      return new Path();
    }
    let str = rawStr;
    let end = str.offset + str.length;
    stream.pos = str.offset;

    let path = new Path();
    /** @type {number[]} */
    let stack = [];
    /** @type {number[]} */
    let trans = [];

    /** @type {number | null} */
    let width = null;
    let nStems = 0;
    let x = 0, y = 0;
    /** @type {Record<number, boolean>} */
    let usedGsubrs;
    /** @type {Record<number, boolean>} */
    let usedSubrs;
    let open = false;

    this._usedGsubrs = usedGsubrs = {};
    this._usedSubrs = usedSubrs = {};

    let gsubrs = cffFont.globalSubrIndex || [];
    let gsubrsBias = this.bias(gsubrs);

    let fetchedPrivate = cffFont.privateDictForGlyph(this.id);
    /** @type {import('../../types/fontkit').CFFPrivateDict} */
    let privateDict = fetchedPrivate ? fetchedPrivate : {};
    /** @type {CFFCharString[]} */
    let subrs = [];
    if (Array.isArray(privateDict.Subrs)) {
      for (let entry of privateDict.Subrs) {
        if (isCFFCharString(entry)) {
          subrs.push(entry);
        }
      }
    }
    let subrsBias = this.bias(subrs);
    let nominalWidthX = typeof privateDict.nominalWidthX === 'number' ? privateDict.nominalWidthX : 0;

    /** @type {ItemVariationStore | undefined} */
    let vstore = (cffFont.topDict.vstore && cffFont.topDict.vstore.itemVariationStore) || undefined;
    /** @type {number} */
    let vsindex = typeof privateDict.vsindex === 'number' ? privateDict.vsindex : 0;
    let variationProcessor = this._font._variationProcessor;
    let font = this._font;

    /**
     * @returns {number}
     */
    function shiftStack() {
      let v = stack.shift();
      if (v === undefined) {
        throw new Error('CFF stack underflow');
      }
      return v;
    }

    /**
     * @returns {number}
     */
    function popStack() {
      let v = stack.pop();
      if (v === undefined) {
        throw new Error('CFF stack underflow');
      }
      return v;
    }

    /**
     * @returns {void}
     */
    function checkWidth() {
      if (width == null) {
        width = shiftStack() + nominalWidthX;
      }
    }

    /**
     * @returns {number}
     */
    function parseStems() {
      if (stack.length % 2 !== 0) {
        checkWidth();
      }

      nStems += stack.length >> 1;
      return stack.length = 0;
    }

    /**
     * @param {number} mx
     * @param {number} my
     * @returns {void}
     */
    function moveTo(mx, my) {
      if (open) {
        path.closePath();
      }

      path.moveTo(mx, my);
      open = true;
    }

    /**
     * @param {string | null | undefined} name
     * @returns {GlyphLike}
     */
    function glyphForName(name) {
      if (name) {
        for (let i = 0; i < font.numGlyphs; i++) {
          if (typeof cffFont.getGlyphName === 'function' && cffFont.getGlyphName(i) === name) {
            let g = font.getGlyph(i);
            if (!g) {
              throw new Error(`CFF glyph ${i} (name "${name}") is missing; font may be corrupt or incomplete`);
            }
            return g;
          }
        }
      }
      let fallback = font.getGlyph(0);
      if (!fallback) {
        throw new Error('CFF glyph 0 (.notdef) is missing; font may be corrupt or incomplete');
      }
      return fallback;
    }

    /**
     * @returns {void}
     */
    let parse = function () {
      while (stream.pos < end) {
        let op = stream.readUInt8();
        if (op < 32) {
          /** @type {number} */
          let index;
          /** @type {CFFCharString | undefined} */
          let subr;
          /** @type {boolean} */
          let phase;
          /** @type {number} */
          let c1x, c1y, c2x, c2y, c3x, c3y;
          /** @type {number} */
          let c4x, c4y, c5x, c5y, c6x, c6y;
          /** @type {number[]} */
          let pts;

          switch (op) {
            case 1: // hstem
            case 3: // vstem
            case 18: // hstemhm
            case 23: // vstemhm
              parseStems();
              break;

            case 4: // vmoveto
              if (stack.length > 1) {
                checkWidth();
              }

              y += shiftStack();
              moveTo(x, y);
              break;

            case 5: // rlineto
              while (stack.length >= 2) {
                x += shiftStack();
                y += shiftStack();
                path.lineTo(x, y);
              }
              break;

            case 6: // hlineto
            case 7: // vlineto
              phase = op === 6;
              while (stack.length >= 1) {
                if (phase) {
                  x += shiftStack();
                } else {
                  y += shiftStack();
                }

                path.lineTo(x, y);
                phase = !phase;
              }
              break;

            case 8: // rrcurveto
              while (stack.length > 0) {
                c1x = x + shiftStack();
                c1y = y + shiftStack();
                c2x = c1x + shiftStack();
                c2y = c1y + shiftStack();
                x = c2x + shiftStack();
                y = c2y + shiftStack();
                path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
              }
              break;

            case 10: // callsubr
              index = popStack() + subrsBias;
              subr = subrs[index];
              if (subr) {
                usedSubrs[index] = true;
                let p = stream.pos;
                let e = end;
                stream.pos = subr.offset;
                end = subr.offset + subr.length;
                parse();
                stream.pos = p;
                end = e;
              }
              break;

            case 11: // return
              if ((cffFont.version ?? 0) >= 2) {
                break;
              }
              return;

            case 14: // endchar
              if ((cffFont.version ?? 0) >= 2) {
                break;
              }

              // Deprecated seac: [width?] adx ady bchar achar endchar (TN5177 App. C)
              if (stack.length >= 4) {
                if (stack.length > 4) {
                  checkWidth();
                }
                let a = glyphForName(StandardEncoding[popStack()]);
                let b = glyphForName(StandardEncoding[popStack()]);
                let ady = popStack();
                let adx = popStack();
                let pos = stream.pos;
                path.commands = b.path.commands.concat(a.path.translate(adx, ady).commands);
                stream.pos = pos;
                open = false;
              } else if (stack.length > 0) {
                checkWidth();
              }

              if (open) {
                path.closePath();
                open = false;
              }
              break;

            case 15: { // vsindex
              if ((cffFont.version ?? 0) < 2) {
                throw new Error('vsindex operator not supported in CFF v1');
              }

              vsindex = popStack();
              break;
            }

            case 16: { // blend
              if ((cffFont.version ?? 0) < 2) {
                throw new Error('blend operator not supported in CFF v1');
              }

              if (!variationProcessor) {
                throw new Error('blend operator in non-variation font');
              }

              if (!vstore) {
                throw new Error('blend operator without variation store');
              }

              let blendVector = variationProcessor.getBlendVector(vstore, vsindex);
              let numBlends = popStack();
              let numOperands = numBlends * blendVector.length;
              /** @type {number} */
              let delta = stack.length - numOperands;
              /** @type {number} */
              let base = delta - numBlends;

              for (let i = 0; i < numBlends; i++) {
                /** @type {number} */
                let sum = stack[base + i];
                for (let j = 0; j < blendVector.length; j++) {
                  sum += blendVector[j] * stack[delta++];
                }

                stack[base + i] = sum;
              }

              while (numOperands--) {
                stack.pop();
              }

              break;
            }

            case 19: // hintmask
            case 20: // cntrmask
              parseStems();
              stream.pos += (nStems + 7) >> 3;
              break;

            case 21: // rmoveto
              if (stack.length > 2) {
                checkWidth();
              }

              x += shiftStack();
              y += shiftStack();
              moveTo(x, y);
              break;

            case 22: // hmoveto
              if (stack.length > 1) {
                checkWidth();
              }

              x += shiftStack();
              moveTo(x, y);
              break;

            case 24: // rcurveline
              while (stack.length >= 8) {
                c1x = x + shiftStack();
                c1y = y + shiftStack();
                c2x = c1x + shiftStack();
                c2y = c1y + shiftStack();
                x = c2x + shiftStack();
                y = c2y + shiftStack();
                path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
              }

              x += shiftStack();
              y += shiftStack();
              path.lineTo(x, y);
              break;

            case 25: // rlinecurve
              while (stack.length >= 8) {
                x += shiftStack();
                y += shiftStack();
                path.lineTo(x, y);
              }

              c1x = x + shiftStack();
              c1y = y + shiftStack();
              c2x = c1x + shiftStack();
              c2y = c1y + shiftStack();
              x = c2x + shiftStack();
              y = c2y + shiftStack();
              path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
              break;

            case 26: // vvcurveto
              if (stack.length % 2) {
                x += shiftStack();
              }

              while (stack.length >= 4) {
                c1x = x;
                c1y = y + shiftStack();
                c2x = c1x + shiftStack();
                c2y = c1y + shiftStack();
                x = c2x;
                y = c2y + shiftStack();
                path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
              }
              break;

            case 27: // hhcurveto
              if (stack.length % 2) {
                y += shiftStack();
              }

              while (stack.length >= 4) {
                c1x = x + shiftStack();
                c1y = y;
                c2x = c1x + shiftStack();
                c2y = c1y + shiftStack();
                x = c2x + shiftStack();
                y = c2y;
                path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
              }
              break;

            case 28: // shortint
              stack.push(stream.readInt16BE());
              break;

            case 29: // callgsubr
              index = popStack() + gsubrsBias;
              {
                let candidate = Array.isArray(gsubrs) ? gsubrs[index] : gsubrs[index];
                if (isCFFCharString(candidate)) {
                  subr = candidate;
                  usedGsubrs[index] = true;
                  let p = stream.pos;
                  let e = end;
                  stream.pos = subr.offset;
                  end = subr.offset + subr.length;
                  parse();
                  stream.pos = p;
                  end = e;
                }
              }
              break;

            case 30: // vhcurveto
            case 31: // hvcurveto
              phase = op === 31;
              while (stack.length >= 4) {
                if (phase) {
                  c1x = x + shiftStack();
                  c1y = y;
                  c2x = c1x + shiftStack();
                  c2y = c1y + shiftStack();
                  y = c2y + shiftStack();
                  x = c2x + (stack.length === 1 ? shiftStack() : 0);
                } else {
                  c1x = x;
                  c1y = y + shiftStack();
                  c2x = c1x + shiftStack();
                  c2y = c1y + shiftStack();
                  x = c2x + shiftStack();
                  y = c2y + (stack.length === 1 ? shiftStack() : 0);
                }

                path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y);
                phase = !phase;
              }
              break;

            case 12: {
              op = stream.readUInt8();
              /** @type {number} */
              let a, b, val, idx;
              switch (op) {
                case 3: // and
                  a = popStack();
                  b = popStack();
                  stack.push(a && b ? 1 : 0);
                  break;

                case 4: // or
                  a = popStack();
                  b = popStack();
                  stack.push(a || b ? 1 : 0);
                  break;

                case 5: // not
                  a = popStack();
                  stack.push(a ? 0 : 1);
                  break;

                case 9: // abs
                  a = popStack();
                  stack.push(Math.abs(a));
                  break;

                case 10: // add
                  a = popStack();
                  b = popStack();
                  stack.push(a + b);
                  break;

                case 11: // sub
                  a = popStack();
                  b = popStack();
                  stack.push(a - b);
                  break;

                case 12: // div
                  a = popStack();
                  b = popStack();
                  stack.push(a / b);
                  break;

                case 14: // neg
                  a = popStack();
                  stack.push(-a);
                  break;

                case 15: // eq
                  a = popStack();
                  b = popStack();
                  stack.push(a === b ? 1 : 0);
                  break;

                case 18: // drop
                  popStack();
                  break;

                case 20: // put
                  val = popStack();
                  idx = popStack();
                  trans[idx] = val;
                  break;

                case 21: // get
                  idx = popStack();
                  stack.push(trans[idx] || 0);
                  break;

                case 22: { // ifelse
                  let s1 = popStack();
                  let s2 = popStack();
                  let v1 = popStack();
                  let v2 = popStack();
                  stack.push(v1 <= v2 ? s1 : s2);
                  break;
                }

                case 23: // random
                  stack.push(Math.random());
                  break;

                case 24: // mul
                  a = popStack();
                  b = popStack();
                  stack.push(a * b);
                  break;

                case 26: // sqrt
                  a = popStack();
                  stack.push(Math.sqrt(a));
                  break;

                case 27: // dup
                  a = popStack();
                  stack.push(a, a);
                  break;

                case 28: // exch
                  a = popStack();
                  b = popStack();
                  stack.push(b, a);
                  break;

                case 29: // index
                  idx = popStack();
                  if (idx < 0) {
                    idx = 0;
                  } else if (idx > stack.length - 1) {
                    idx = stack.length - 1;
                  }

                  stack.push(stack[idx]);
                  break;

                case 30: { // roll
                  /** @type {number} */
                  let n = popStack();
                  /** @type {number} */
                  let j = popStack();

                  if (j >= 0) {
                    while (j > 0) {
                      /** @type {number} */
                      let t = stack[n - 1];
                      for (/** @type {number} */ let i = n - 2; i >= 0; i--) {
                        stack[i + 1] = stack[i];
                      }

                      stack[0] = t;
                      j--;
                    }
                  } else {
                    while (j < 0) {
                      /** @type {number} */
                      let t = stack[0];
                      for (/** @type {number} */ let i = 0; i <= n; i++) {
                        stack[i] = stack[i + 1];
                      }

                      stack[n - 1] = t;
                      j++;
                    }
                  }
                  break;
                }

                case 34: // hflex
                  c1x = x + shiftStack();
                  c1y = y;
                  c2x = c1x + shiftStack();
                  c2y = c1y + shiftStack();
                  c3x = c2x + shiftStack();
                  c3y = c2y;
                  c4x = c3x + shiftStack();
                  c4y = c3y;
                  c5x = c4x + shiftStack();
                  c5y = c4y;
                  c6x = c5x + shiftStack();
                  c6y = c5y;
                  x = c6x;
                  y = c6y;

                  path.bezierCurveTo(c1x, c1y, c2x, c2y, c3x, c3y);
                  path.bezierCurveTo(c4x, c4y, c5x, c5y, c6x, c6y);
                  break;

                case 35: // flex
                  pts = [];

                  for (let i = 0; i <= 5; i++) {
                    x += shiftStack();
                    y += shiftStack();
                    pts.push(x, y);
                  }

                  path.bezierCurveTo(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
                  path.bezierCurveTo(pts[6], pts[7], pts[8], pts[9], pts[10], pts[11]);
                  shiftStack(); // fd
                  break;

                case 36: // hflex1
                  c1x = x + shiftStack();
                  c1y = y + shiftStack();
                  c2x = c1x + shiftStack();
                  c2y = c1y + shiftStack();
                  c3x = c2x + shiftStack();
                  c3y = c2y;
                  c4x = c3x + shiftStack();
                  c4y = c3y;
                  c5x = c4x + shiftStack();
                  c5y = c4y + shiftStack();
                  c6x = c5x + shiftStack();
                  c6y = c5y;
                  x = c6x;
                  y = c6y;

                  path.bezierCurveTo(c1x, c1y, c2x, c2y, c3x, c3y);
                  path.bezierCurveTo(c4x, c4y, c5x, c5y, c6x, c6y);
                  break;

                case 37: { // flex1
                  let startx = x;
                  let starty = y;

                  pts = [];
                  for (let i = 0; i <= 4; i++) {
                    x += shiftStack();
                    y += shiftStack();
                    pts.push(x, y);
                  }

                  if (Math.abs(x - startx) > Math.abs(y - starty)) { // horizontal
                    x += shiftStack();
                    y = starty;
                  } else {
                    x = startx;
                    y += shiftStack();
                  }

                  pts.push(x, y);
                  path.bezierCurveTo(pts[0], pts[1], pts[2], pts[3], pts[4], pts[5]);
                  path.bezierCurveTo(pts[6], pts[7], pts[8], pts[9], pts[10], pts[11]);
                  break;
                }

                default:
                  throw new Error(`Unknown op: 12 ${op}`);
              }
              break;
            }

            default:
              throw new Error(`Unknown op: ${op}`);
          }
        } else if (op < 247) {
          stack.push(op - 139);
        } else if (op < 251) {
          let b1 = stream.readUInt8();
          stack.push((op - 247) * 256 + b1 + 108);
        } else if (op < 255) {
          let b1 = stream.readUInt8();
          stack.push(-(op - 251) * 256 - b1 - 108);
        } else {
          stack.push(stream.readInt32BE() / 65536);
        }
      }
    };

    parse();

    if (open) {
      path.closePath();
    }

    return path;
  }
}

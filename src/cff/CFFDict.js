import CFFOperand from './CFFOperand';
import { PropertyDescriptor } from 'restructure';
import { deepEqual } from '../utils';

/** @typedef {import('restructure').BaseType} BaseType */
/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').CFFDictField} CFFDictField */
/** @typedef {import('../../types/fontkit').CFFOperandType} CFFOperandType */
/** @typedef {import('../../types/fontkit').CFFEncodeContext} CFFEncodeContext */

/** @typedef {number | { forceLarge?: boolean, valueOf(): number }} CFFOperandValue */

/**
 * @param {CFFOperandType} type
 * @returns {type is BaseType}
 */
function isCodec(type) {
  return typeof type === 'object' && type != null && !Array.isArray(type);
}

export default class CFFDict {
  /**
   * @param {CFFDictField[]} [ops]
   */
  constructor(ops = []) {
    /** @type {CFFDictField[]} */
    this.ops = ops;
    /** @type {Record<number, CFFDictField>} */
    this.fields = {};
    for (let field of ops) {
      let key = Array.isArray(field[0]) ? field[0][0] << 8 | field[0][1] : field[0];
      this.fields[key] = field;
    }
  }

  /**
   * @param {CFFOperandType} type
   * @param {DecodeStream} stream
   * @param {StructValue} ret
   * @param {unknown[]} operands
   * @returns {unknown}
   */
  decodeOperands(type, stream, ret, operands) {
    if (Array.isArray(type)) {
      return operands.map((op, i) => this.decodeOperands(type[i], stream, ret, [op]));
    } else if (isCodec(type) && type.decode != null) {
      return type.decode(stream, ret, operands);
    } else {
      switch (type) {
        case 'number':
        case 'offset':
        case 'sid':
          return operands[0];
        case 'boolean':
          return !!operands[0];
        default:
          return operands;
      }
    }
  }

  /**
   * @param {CFFOperandType} type
   * @param {EncodeStream | null} stream
   * @param {CFFEncodeContext | StructValue} ctx
   * @param {unknown} operands
   * @returns {unknown[]}
   */
  encodeOperands(type, stream, ctx, operands) {
    if (Array.isArray(type)) {
      if (!Array.isArray(operands)) {
        return [operands];
      }
      return operands.map((op, i) => this.encodeOperands(type[i], stream, ctx, op)[0]);
    } else if (isCodec(type) && type.encode != null) {
      let encoded = type.encode(stream, operands, ctx);
      if (Array.isArray(encoded)) {
        return encoded;
      }
      // Custom ops must return an operand list; coerce scalars (e.g. sid index).
      return [encoded];
    } else if (typeof operands === 'number') {
      return [operands];
    } else if (typeof operands === 'boolean') {
      return [+operands];
    } else if (Array.isArray(operands)) {
      return operands;
    } else {
      return [operands];
    }
  }

  /**
   * @param {DecodeStream} stream
   * @param {StructValue} parent
   * @returns {StructValue}
   */
  decode(stream, parent) {
    let dictLength = typeof parent.length === 'number' ? parent.length : 0;
    let end = stream.pos + dictLength;
    /** @type {StructValue} */
    let ret = {};
    /** @type {unknown[]} */
    let operands = [];

    // define hidden properties
    Object.defineProperties(ret, {
      parent: { value: parent },
      _startOffset: { value: stream.pos }
    });

    // fill in defaults
    for (let key in this.fields) {
      let field = this.fields[key];
      ret[field[1]] = field[3];
    }

    while (stream.pos < end) {
      let b = stream.readUInt8();
      if (b < 28) {
        if (b === 12) {
          b = (b << 8) | stream.readUInt8();
        }

        let field = this.fields[b];
        if (!field) {
          throw new Error(`Unknown operator ${b}`);
        }

        let val = this.decodeOperands(field[2], stream, ret, operands);
        if (val != null) {
          if (val instanceof PropertyDescriptor) {
            Object.defineProperty(ret, field[1], val);
          } else {
            ret[field[1]] = val;
          }
        }

        operands = [];
      } else {
        operands.push(CFFOperand.decode(stream, b));
      }
    }

    return ret;
  }

  /**
   * @param {StructValue} dict
   * @param {StructValue | CFFEncodeContext} parent
   * @param {boolean} [includePointers]
   * @returns {number}
   */
  size(dict, parent, includePointers = true) {
    /** @type {CFFEncodeContext} */
    let ctx = {
      parent,
      val: dict,
      pointerSize: 0,
      startOffset: (typeof parent.startOffset === 'number' ? parent.startOffset : 0),
      pointers: []
    };

    let len = 0;

    for (let k in this.fields) {
      let field = this.fields[k];
      let val = dict[field[1]];
      if (val == null || deepEqual(val, field[3])) {
        continue;
      }

      let operands = this.encodeOperands(field[2], null, ctx, val);
      for (let op of operands) {
        len += CFFOperand.size(/** @type {CFFOperandValue} */ (op));
      }

      let key = Array.isArray(field[0]) ? field[0] : [field[0]];
      len += key.length;
    }

    if (includePointers) {
      len += ctx.pointerSize;
    }

    return len;
  }

  /**
   * @param {EncodeStream} stream
   * @param {StructValue} dict
   * @param {StructValue | null | undefined} parent
   * @returns {void}
   */
  encode(stream, dict, parent) {
    /** @type {CFFEncodeContext} */
    let ctx = {
      pointers: [],
      startOffset: stream.pos,
      parent: parent ?? undefined,
      val: dict,
      pointerSize: 0
    };

    ctx.pointerOffset = stream.pos + this.size(dict, ctx, false);

    for (let field of this.ops) {
      let val = dict[field[1]];
      if (val == null || deepEqual(val, field[3])) {
        continue;
      }

      let operands = this.encodeOperands(field[2], stream, ctx, val);
      for (let op of operands) {
        CFFOperand.encode(stream, /** @type {CFFOperandValue} */ (op));
      }

      let key = Array.isArray(field[0]) ? field[0] : [field[0]];
      for (let op of key) {
        stream.writeUInt8(op);
      }
    }

    let i = 0;
    while (i < ctx.pointers.length) {
      let ptr = ctx.pointers[i++];
      if (ptr.type.encode) {
        ptr.type.encode(stream, ptr.val, ptr.parent);
      }
    }

    return;
  }
}

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').EncodeStream} EncodeStream */

/**
 * Operand value that may force a 32-bit encoding (e.g. CFF pointer placeholders).
 * @typedef {number | { forceLarge?: boolean, valueOf(): number }} CFFOperandValue
 */

const FLOAT_EOF = 0xf;
const FLOAT_LOOKUP = [
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', '.', 'E', 'E-', null, '-'
];

/** @type {Record<string, number>} */
const FLOAT_ENCODE_LOOKUP = {
  '.': 10,
  E: 11,
  'E-': 12,
  '-': 14
};

export default class CFFOperand {
  /**
   * @param {DecodeStream} stream
   * @param {number} value
   * @returns {number | null}
   */
  static decode(stream, value) {
    if (32 <= value && value <= 246) {
      return value - 139;
    }

    if (247 <= value && value <= 250) {
      return (value - 247) * 256 + stream.readUInt8() + 108;
    }

    if (251 <= value && value <= 254) {
      return -(value - 251) * 256 - stream.readUInt8() - 108;
    }

    if (value === 28) {
      return stream.readInt16BE();
    }

    if (value === 29) {
      return stream.readInt32BE();
    }

    if (value === 30) {
      let str = '';
      while (true) {
        let b = stream.readUInt8();

        let n1 = b >> 4;
        if (n1 === FLOAT_EOF) { break; }
        str += FLOAT_LOOKUP[n1];

        let n2 = b & 15;
        if (n2 === FLOAT_EOF) { break; }
        str += FLOAT_LOOKUP[n2];
      }

      return parseFloat(str);
    }

    return null;
  }

  /**
   * @param {CFFOperandValue} value
   * @returns {number}
   */
  static size(value) {
    // if the value needs to be forced to the largest size (32 bit)
    // e.g. for unknown pointers, set to 32768
    /** @type {number} */
    let n;
    if (value && typeof value === 'object' && value.forceLarge) {
      n = 32768;
    } else {
      n = Number(value);
    }

    if ((n | 0) !== n) { // floating point
      let str = '' + n;
      return 1 + Math.ceil((str.length + 1) / 2);
    } else if (-107 <= n && n <= 107) {
      return 1;
    } else if (108 <= n && n <= 1131 || -1131 <= n && n <= -108) {
      return 2;
    } else if (-32768 <= n && n <= 32767) {
      return 3;
    } else {
      return 5;
    }
  }

  /**
   * @param {EncodeStream} stream
   * @param {CFFOperandValue} value
   * @returns {void}
   */
  static encode(stream, value) {
    // if the value needs to be forced to the largest size (32 bit)
    // e.g. for unknown pointers, save the old value and set to 32768
    let val = Number(value);

    if (value && typeof value === 'object' && value.forceLarge) {
      stream.writeUInt8(29);
      stream.writeInt32BE(val);
      return;
    } else if ((val | 0) !== val) { // floating point
      stream.writeUInt8(30);

      let str = '' + val;
      /** @type {number | undefined} */
      let n2;
      for (let i = 0; i < str.length; i += 2) {
        let c1 = str[i];
        let n1 = FLOAT_ENCODE_LOOKUP[c1] ?? (+c1);

        if (i === str.length - 1) {
          n2 = FLOAT_EOF;
        } else {
          let c2 = str[i + 1];
          n2 = FLOAT_ENCODE_LOOKUP[c2] ?? (+c2);
        }

        stream.writeUInt8((n1 << 4) | (n2 & 15));
      }

      if (n2 !== FLOAT_EOF) {
        stream.writeUInt8((FLOAT_EOF << 4));
      }
      return;
    } else if (-107 <= val && val <= 107) {
      stream.writeUInt8(val + 139);
      return;
    } else if (108 <= val && val <= 1131) {
      val -= 108;
      stream.writeUInt8((val >> 8) + 247);
      stream.writeUInt8(val & 0xff);
      return;
    } else if (-1131 <= val && val <= -108) {
      val = -val - 108;
      stream.writeUInt8((val >> 8) + 251);
      stream.writeUInt8(val & 0xff);
      return;
    } else if (-32768 <= val && val <= 32767) {
      stream.writeUInt8(28);
      stream.writeInt16BE(val);
      return;
    } else {
      stream.writeUInt8(29);
      stream.writeInt32BE(val);
      return;
    }
  }
}

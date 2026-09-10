import CFFTop from './CFFTop';
import standardStrings from './CFFStandardStrings';

/** @typedef {import('restructure').DecodeStream} DecodeStream */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('restructure').StructValue} StructValue */
/** @typedef {import('../../types/fontkit').CFFTopDict} CFFTopDict */
/** @typedef {import('../../types/fontkit').CFFPrivateDict} CFFPrivateDict */
/** @typedef {import('../../types/fontkit').CFFCharString} CFFCharString */

/**
 * Decoded CFF / CFF2 font table.
 * Properties from CFFTop are copied onto the instance in decode().
 */
class CFFFont {
  /**
   * @param {DecodeStream} stream
   */
  constructor(stream) {
    /** @type {DecodeStream} */
    this.stream = stream;
    /** @type {number} */
    this.version = 0;
    /** @type {number | undefined} */
    this.hdrSize = undefined;
    /** @type {CFFTopDict} */
    this.topDict = /** @type {CFFTopDict} */ ({ CharStrings: [] });
    /** @type {StructValue[] | undefined} */
    this.topDictIndex = undefined;
    /** @type {string[] | undefined} */
    this.nameIndex = undefined;
    /** @type {string[] | undefined} */
    this.stringIndex = undefined;
    /** @type {CFFCharString[] | undefined} */
    this.globalSubrIndex = undefined;
    /** @type {boolean} */
    this.isCIDFont = false;
    this.decode();
  }

  /**
   * @param {DecodeStream} stream
   * @returns {CFFFont}
   */
  static decode(stream) {
    return new CFFFont(stream);
  }

  /**
   * @returns {this}
   */
  decode() {
    let top = CFFTop.decode(this.stream);
    for (let key in top) {
      /** @type {Record<string, unknown>} */ (/** @type {unknown} */ (this))[key] = top[key];
    }

    if (this.version < 2) {
      if (!this.topDictIndex || this.topDictIndex.length !== 1) {
        throw new Error('Only a single font is allowed in CFF');
      }

      this.topDict = /** @type {CFFTopDict} */ (this.topDictIndex[0]);
    }

    this.isCIDFont = this.topDict.ROS != null;
    return this;
  }

  /**
   * @param {number | null | undefined} sid
   * @returns {string | null}
   */
  string(sid) {
    if (this.version >= 2) {
      return null;
    }

    if (sid == null) {
      return null;
    }

    if (sid < standardStrings.length) {
      return standardStrings[sid];
    }

    return this.stringIndex ? this.stringIndex[sid - standardStrings.length] : null;
  }

  /**
   * @returns {string | null}
   */
  get postscriptName() {
    if (this.version < 2) {
      return this.nameIndex ? this.nameIndex[0] : null;
    }

    return null;
  }

  /**
   * @returns {string | null}
   */
  get fullName() {
    return this.string(this.topDict.FullName);
  }

  /**
   * @returns {string | null}
   */
  get familyName() {
    return this.string(this.topDict.FamilyName);
  }

  /**
   * @param {number} glyph
   * @returns {BinaryBuffer}
   */
  getCharString(glyph) {
    let cs = /** @type {CFFCharString} */ (this.topDict.CharStrings[glyph]);
    this.stream.pos = cs.offset;
    return this.stream.readBuffer(cs.length);
  }

  /**
   * @param {number} gid
   * @returns {string | null}
   */
  getGlyphName(gid) {
    // CFF2 glyph names are in the post table.
    if (this.version >= 2) {
      return null;
    }

    // CID-keyed fonts don't have glyph names
    if (this.isCIDFont) {
      return null;
    }

    let { charset } = this.topDict;
    if (Array.isArray(charset)) {
      return /** @type {string} */ (charset[gid]);
    }

    if (gid === 0) {
      return '.notdef';
    }

    gid -= 1;

    if (!charset || typeof charset !== 'object') {
      return null;
    }

    /**
     * @typedef {{
     *   version?: number,
     *   glyphs?: number[],
     *   ranges?: Array<{ offset: number, nLeft: number, first: number }>
     * }} CharsetTable
     */
    let cs = /** @type {StructValue & CharsetTable} */ (charset);

    switch (cs.version) {
      case 0:
        return this.string(cs.glyphs ? cs.glyphs[gid] : undefined);

      case 1:
      case 2:
        if (!cs.ranges) {
          return null;
        }
        for (let i = 0; i < cs.ranges.length; i++) {
          let range = cs.ranges[i];
          if (range.offset <= gid && gid <= range.offset + range.nLeft) {
            return this.string(range.first + (gid - range.offset));
          }
        }
        break;
    }

    return null;
  }

  /**
   * @param {number} gid
   * @returns {number | null}
   */
  fdForGlyph(gid) {
    if (!this.topDict.FDSelect) {
      return null;
    }

    let fdSelect = this.topDict.FDSelect;

    switch (fdSelect.version) {
      case 0:
        return fdSelect.fds ? fdSelect.fds[gid] : null;

      case 3:
      case 4: {
        let { ranges } = fdSelect;
        if (!ranges) {
          return null;
        }
        let low = 0;
        let high = ranges.length - 1;

        while (low <= high) {
          let mid = (low + high) >> 1;
          let midRange = ranges[mid];
          let nextRange = ranges[mid + 1];

          if (gid < midRange.first) {
            high = mid - 1;
          } else if (mid < high && nextRange && gid >= nextRange.first) {
            low = mid + 1;
          } else {
            return midRange.fd;
          }
        }

        throw new Error(`Unknown FDSelect version: ${fdSelect.version}`);
      }
      default:
        throw new Error(`Unknown FDSelect version: ${fdSelect.version}`);
    }
  }

  /**
   * @param {number} gid
   * @returns {CFFPrivateDict | null | undefined}
   */
  privateDictForGlyph(gid) {
    if (this.topDict.FDSelect) {
      let fd = this.fdForGlyph(gid);
      if (fd != null && this.topDict.FDArray && this.topDict.FDArray[fd]) {
        return this.topDict.FDArray[fd].Private;
      }

      return null;
    }

    if (this.version < 2) {
      return this.topDict.Private;
    }

    return this.topDict.FDArray && this.topDict.FDArray[0]
      ? this.topDict.FDArray[0].Private
      : null;
  }
}

export default CFFFont;

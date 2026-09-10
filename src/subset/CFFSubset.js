import Subset from './Subset';
import CFFTop from '../cff/CFFTop';
import standardStrings from '../cff/CFFStandardStrings';

/** @typedef {import('../../types/fontkit').SubsetFont} SubsetFont */
/** @typedef {import('../../types/fontkit').CFFFontLike} CFFFontLike */
/** @typedef {import('../../types/fontkit').CFFTopDict} CFFTopDict */
/** @typedef {import('../../types/fontkit').CFFCharString} CFFCharString */
/** @typedef {import('restructure').BinaryBuffer} BinaryBuffer */
/** @typedef {import('restructure').StructValue} StructValue */

export default class CFFSubset extends Subset {
  /** @type {CFFFontLike} */
  cff;
  /** @type {BinaryBuffer[] | null} */
  charstrings = null;
  /** @type {BinaryBuffer[] | null} */
  gsubrs = null;
  /** @type {string[] | null} */
  strings = null;

  /**
   * @param {SubsetFont} font
   */
  constructor(font) {
    super(font);

    let cff = this.font['CFF '];
    if (!cff) {
      throw new Error('Not a CFF Font');
    }
    this.cff = cff;
  }

  /**
   * @param {string} [_tag]
   * @returns {never}
   */
  includeTable(_tag) {
    throw new Error('includeTable is only supported for TrueType (glyf) subsets, not CFF.');
  }

  /**
   * @returns {void}
   */
  subsetCharstrings() {
    this.charstrings = [];
    /** @type {Record<string, boolean>} */
    let gsubrs = {};

    for (let gid of this.glyphs) {
      if (!this.cff.getCharString) {
        throw new Error('CFF font missing getCharString()');
      }
      this.charstrings.push(this.cff.getCharString(gid));

      let glyph = this.font.getGlyph(gid);
      if (!glyph) {
        continue;
      }
      void glyph.path; // this causes the glyph to be parsed

      if (glyph._usedGsubrs) {
        for (let subr in glyph._usedGsubrs) {
          gsubrs[subr] = true;
        }
      }
    }

    this.gsubrs = this.subsetSubrs(
      /** @type {Array<{ offset: number, length: number }>} */ (this.cff.globalSubrIndex || []),
      gsubrs
    );
  }

  /**
   * @param {Array<{ offset: number, length: number }>} subrs
   * @param {Record<string | number, boolean>} used
   * @returns {BinaryBuffer[]}
   */
  subsetSubrs(subrs, used) {
    /** @type {BinaryBuffer[]} */
    let res = [];
    for (let i = 0; i < subrs.length; i++) {
      let subr = subrs[i];
      if (used[i]) {
        this.cff.stream.pos = subr.offset;
        res.push(this.cff.stream.readBuffer(subr.length));
      } else {
        res.push(new Uint8Array([11])); // return
      }
    }

    return res;
  }

  /**
   * @param {CFFTopDict} topDict
   * @returns {void}
   */
  subsetFontdict(topDict) {
    topDict.FDArray = [];
    topDict.FDSelect = {
      version: 0,
      fds: []
    };

    /** @type {Record<number, boolean>} */
    let used_fds = {};
    /** @type {Array<Record<string, boolean>>} */
    let used_subrs = [];
    /** @type {Record<number, number>} */
    let fd_select = {};
    for (let gid of this.glyphs) {
      if (!this.cff.fdForGlyph) {
        continue;
      }
      let fd = this.cff.fdForGlyph(gid);
      if (fd == null) {
        continue;
      }

      if (!used_fds[fd]) {
        let src = this.cff.topDict.FDArray && this.cff.topDict.FDArray[fd];
        topDict.FDArray.push(Object.assign({}, src));
        used_subrs.push({});
        fd_select[fd] = topDict.FDArray.length - 1;
      }

      used_fds[fd] = true;
      if (topDict.FDSelect.fds) {
        topDict.FDSelect.fds.push(fd_select[fd]);
      }

      let glyph = this.font.getGlyph(gid);
      if (!glyph) {
        continue;
      }
      void glyph.path; // this causes the glyph to be parsed
      if (glyph._usedSubrs) {
        for (let subr in glyph._usedSubrs) {
          used_subrs[fd_select[fd]][subr] = true;
        }
      }
    }

    for (let i = 0; i < topDict.FDArray.length; i++) {
      let dict = topDict.FDArray[i];
      delete dict.FontName;
      if (dict.Private && dict.Private.Subrs) {
        dict.Private = Object.assign({}, dict.Private);
        dict.Private.Subrs = this.subsetSubrs(
          /** @type {Array<{ offset: number, length: number }>} */ (dict.Private.Subrs),
          used_subrs[i]
        );
      }
    }

    return;
  }

  /**
   * @param {CFFTopDict} topDict
   * @returns {StructValue}
   */
  createCIDFontdict(topDict) {
    /** @type {Record<string, boolean>} */
    let used_subrs = {};
    for (let gid of this.glyphs) {
      let glyph = this.font.getGlyph(gid);
      if (!glyph) {
        continue;
      }
      void glyph.path; // this causes the glyph to be parsed

      if (glyph._usedSubrs) {
        for (let subr in glyph._usedSubrs) {
          used_subrs[subr] = true;
        }
      }
    }

    let privateDict = Object.assign({}, this.cff.topDict.Private);
    if (this.cff.topDict.Private && this.cff.topDict.Private.Subrs) {
      privateDict.Subrs = this.subsetSubrs(
        /** @type {Array<{ offset: number, length: number }>} */ (this.cff.topDict.Private.Subrs),
        used_subrs
      );
    }

    topDict.FDArray = [{ Private: privateDict }];
    let charstrings = this.charstrings || [];
    return topDict.FDSelect = {
      version: 3,
      nRanges: 1,
      ranges: [{ first: 0, fd: 0 }],
      sentinel: charstrings.length
    };
  }

  /**
   * @param {string | null | undefined} string
   * @returns {number | null}
   */
  addString(string) {
    if (!string) {
      return null;
    }

    if (!this.strings) {
      this.strings = [];
    }

    this.strings.push(string);
    return standardStrings.length + this.strings.length - 1;
  }

  /**
   * @returns {import('restructure').BinaryBuffer}
   */
  encode() {
    this.subsetCharstrings();

    let charstrings = this.charstrings || [];

    let charset = {
      version: charstrings.length > 255 ? 2 : 1,
      ranges: charstrings.length > 1
        ? [{ first: 1, nLeft: charstrings.length - 2 }]
        : []
    };

    let topDict = /** @type {CFFTopDict} */ (Object.assign({}, this.cff.topDict));
    topDict.Private = null;
    topDict.charset = charset;
    topDict.Encoding = null;
    topDict.CharStrings = charstrings;

    for (let key of ['version', 'Notice', 'Copyright', 'FullName', 'FamilyName', 'Weight', 'PostScript', 'BaseFontName', 'FontName']) {
      let sid = /** @type {number | null | undefined} */ (topDict[key]);
      topDict[key] = this.cff.string ? this.addString(this.cff.string(sid)) : null;
    }

    topDict.ROS = [this.addString('Adobe'), this.addString('Identity'), 0];
    topDict.CIDCount = charstrings.length;

    if (this.cff.isCIDFont) {
      this.subsetFontdict(topDict);
    } else {
      this.createCIDFontdict(topDict);
    }

    let top = {
      version: 1,
      hdrSize: this.cff.hdrSize,
      offSize: 4,
      header: this.cff.header,
      nameIndex: [this.cff.postscriptName],
      topDictIndex: [topDict],
      stringIndex: this.strings,
      globalSubrIndex: this.gsubrs
    };

    return CFFTop.toBuffer(top);
  }
}

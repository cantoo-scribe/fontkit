import * as r from 'restructure';
import { getEncoding, LANGUAGES } from '../encodings';

/** @typedef {import('restructure').StructValue} StructValue */

/**
 * @typedef {{
 *   platformID: number,
 *   encodingID: number,
 *   languageID: number,
 *   nameID: number,
 *   length: number,
 *   string: string
 * }} NameRecordValue
 */

/**
 * @typedef {Record<string, string | unknown>} LangStringMap
 */

/**
 * @typedef {{
 *   fontFeatures: Record<number, LangStringMap>,
 *   reservedNameID?: Record<number, LangStringMap>,
 *   [key: string]: LangStringMap | Record<number, LangStringMap> | undefined
 * }} NameRecordsMap
 */

/**
 * @typedef {StructValue & {
 *   version: number,
 *   count: number,
 *   stringOffset: number,
 *   records: NameRecordValue[] | NameRecordsMap,
 *   langTags?: Array<{ tag: string }>
 * }} NameTableValue
 */

let NameRecord = new r.Struct({
  platformID: r.uint16,
  encodingID: r.uint16,
  languageID: r.uint16,
  nameID: r.uint16,
  length: r.uint16,
  string: new r.Pointer(
    r.uint16,
    new r.String(
      'length',
      /** @param {StructValue} t @returns {string} */
      t => getEncoding(
        /** @type {number} */ (t.platformID),
        /** @type {number} */ (t.encodingID),
        /** @type {number} */ (t.languageID)
      ) || 'utf16be'
    ),
    {
      type: 'parent',
      /** @param {StructValue} ctx @returns {number} */
      relativeTo: ctx => /** @type {number} */ (/** @type {StructValue} */ (ctx.parent).stringOffset),
      allowNull: false
    }
  )
});

let LangTagRecord = new r.Struct({
  length: r.uint16,
  tag: new r.Pointer(
    r.uint16,
    new r.String('length', 'utf16be'),
    {
      type: 'parent',
      /** @param {StructValue} ctx @returns {number} */
      relativeTo: ctx => /** @type {number} */ (ctx.stringOffset)
    }
  )
});

/** @type {import('restructure').VersionedStruct} */
var NameTable = new r.VersionedStruct(r.uint16, {
  0: {
    count: r.uint16,
    stringOffset: r.uint16,
    records: new r.Array(NameRecord, 'count')
  },
  1: {
    count: r.uint16,
    stringOffset: r.uint16,
    records: new r.Array(NameRecord, 'count'),
    langTagCount: r.uint16,
    langTags: new r.Array(LangTagRecord, 'langTagCount')
  }
});

export default NameTable;

const NAMES = [
  'copyright',
  'fontFamily',
  'fontSubfamily',
  'uniqueSubfamily',
  'fullName',
  'version',
  'postscriptName', // Note: A font may have only one PostScript name and that name must be ASCII.
  'trademark',
  'manufacturer',
  'designer',
  'description',
  'vendorURL',
  'designerURL',
  'license',
  'licenseURL',
  null, // reserved (nameID 15)
  'preferredFamily',
  'preferredSubfamily',
  'compatibleFull',
  'sampleText',
  'postscriptCIDFontName',
  'wwsFamilyName',
  'wwsSubfamilyName',
  'lightBackgroundPalette',
  'darkBackgroundPalette',
  'variationsPostScriptNamePrefix'
];

/**
 * @param {NameRecordValue[]} out
 * @param {number} nameID
 * @param {unknown} string
 * @returns {void}
 */
function pushEnRecord(out, nameID, string) {
  if (typeof string !== 'string') return;

  out.push({
    platformID: 3,
    encodingID: 1,
    languageID: 0x409,
    nameID,
    length: string.length * 2,
    string
  });
}

NameTable.process = function (_stream) {
  let self = /** @type {NameTableValue} */ (this);
  /** @type {NameRecordsMap} */
  let records = { fontFeatures: {} };

  for (let record of /** @type {NameRecordValue[]} */ (self.records)) {
    let platformMap = LANGUAGES[record.platformID] || {};
    /** @type {string | undefined} */
    let language = platformMap[record.languageID];

    if (language == null && self.langTags != null && record.languageID >= 0x8000) {
      language = self.langTags[record.languageID - 0x8000].tag;
    }

    if (language == null) {
      language = record.platformID + '-' + record.languageID;
    }

    // Single store keyed by nameID (feat/fvar look up fontFeatures[id]).
    let byId = records.fontFeatures[record.nameID] || (records.fontFeatures[record.nameID] = {});
    if (typeof record.string === 'string' || typeof byId[language] !== 'string') {
      byId[language] = record.string;
    }

    // Alias standard / reserved IDs onto friendly keys (same object).
    if (record.nameID >= 256) continue;

    let name = NAMES[record.nameID];
    if (name) {
      records[name] = byId;
    } else {
      if (records.reservedNameID == null) records.reservedNameID = {};
      records.reservedNameID[record.nameID] = byId;
    }
  }

  self.records = records;
};

NameTable.preEncode = function () {
  let self = /** @type {NameTableValue} */ (this);
  if (Array.isArray(self.records)) return;
  self.version = 0;

  /** @type {NameRecordValue[]} */
  let records = [];
  /** @type {NameRecordsMap} */
  let map = self.records;
  for (let key of Object.keys(map)) {
    let val = map[key];

    if (key === 'fontFeatures') {
      // Mirrors of IDs < 256 are encoded via named/reserved keys above.
      let features = /** @type {Record<number, LangStringMap>} */ (val);
      for (let id of Object.keys(features)) {
        if (+id >= 256) {
          let langs = features[+id];
          pushEnRecord(records, +id, langs && langs.en);
        }
      }
      continue;
    }

    if (key === 'reservedNameID') {
      let reserved = /** @type {Record<number, LangStringMap>} */ (val);
      for (let id of Object.keys(reserved)) {
        let langs = reserved[+id];
        pushEnRecord(records, +id, langs && langs.en);
      }
      continue;
    }

    let nameID = NAMES.indexOf(key);
    if (nameID < 0) continue;

    let langs = /** @type {LangStringMap} */ (val);
    pushEnRecord(records, nameID, langs.en);

    // Match historical behaviour: also write PostScript name for Mac platform.
    if (key === 'postscriptName' && typeof langs.en === 'string') {
      records.push({
        platformID: 1,
        encodingID: 0,
        languageID: 0,
        nameID,
        length: langs.en.length,
        string: langs.en
      });
    }
  }

  self.records = records;
  self.count = records.length;
  self.stringOffset = NameTable.size(self, null, false);
};

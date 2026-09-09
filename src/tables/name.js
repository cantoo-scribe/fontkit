import * as r from 'restructure';
import { getEncoding, LANGUAGES } from '../encodings';

let NameRecord = new r.Struct({
  platformID: r.uint16,
  encodingID: r.uint16,
  languageID: r.uint16,
  nameID: r.uint16,
  length: r.uint16,
  string: new r.Pointer(r.uint16,
    new r.String('length', t => getEncoding(t.platformID, t.encodingID, t.languageID)),
    { type: 'parent', relativeTo: ctx => ctx.parent.stringOffset, allowNull: false }
  )
});

let LangTagRecord = new r.Struct({
  length: r.uint16,
  tag: new r.Pointer(r.uint16, new r.String('length', 'utf16be'), { type: 'parent', relativeTo: ctx => ctx.stringOffset })
});

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
  let records = { fontFeatures: {} };

  for (let record of this.records) {
    let language = LANGUAGES[record.platformID][record.languageID];

    if (language == null && this.langTags != null && record.languageID >= 0x8000) {
      language = this.langTags[record.languageID - 0x8000].tag;
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

  this.records = records;
};

NameTable.preEncode = function () {
  if (Array.isArray(this.records)) return;
  this.version = 0;

  let records = [];
  for (let key in this.records) {
    let val = this.records[key];

    if (key === 'fontFeatures') {
      // Mirrors of IDs < 256 are encoded via named/reserved keys above.
      for (let id in val) {
        if (+id >= 256) pushEnRecord(records, +id, val[id].en);
      }
      continue;
    }

    if (key === 'reservedNameID') {
      for (let id in val) pushEnRecord(records, +id, val[id].en);
      continue;
    }

    let nameID = NAMES.indexOf(key);
    if (nameID < 0) continue;

    pushEnRecord(records, nameID, val.en);

    // Match historical behaviour: also write PostScript name for Mac platform.
    if (key === 'postscriptName' && typeof val.en === 'string') {
      records.push({
        platformID: 1,
        encodingID: 0,
        languageID: 0,
        nameID,
        length: val.en.length,
        string: val.en
      });
    }
  }

  this.records = records;
  this.count = records.length;
  this.stringOffset = NameTable.size(this, null, false);
};

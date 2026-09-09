import * as fontkit from 'fontkit';
import assert from 'assert';
import NameTable from '../../src/tables/name.js';

describe('name table', function () {
  describe('Mada-VF decode', function () {
    let font = fontkit.openSync(new URL('../data/Mada/Mada-VF.ttf', import.meta.url));
    let { records } = font.name;

    it('exposes standard name IDs present in the font', function () {
      assert.equal(
        records.copyright.en,
        'Copyright © 2015-2017 The Mada Project Authors, with Reserved Font Name "Source". Source is a trademark of Adobe Systems Incorporated in the United States and/or other countries.'
      );
      assert.equal(records.fontFamily.en, 'Mada Medium');
      assert.equal(records.fontSubfamily.en, 'Regular');
      assert.equal(records.uniqueSubfamily.en, 'Version 1.004;ALIF;Mada Medium Regular');
      assert.equal(records.fullName.en, 'Mada Medium');
      assert.equal(records.version.en, 'Version 1.004');
      assert.equal(records.postscriptName.en, 'Mada-Medium');
      assert.equal(records.designer.en, 'Khaled Hosny');
      assert.equal(
        records.description.en,
        'Mada is a geometric, unmodulted Arabic display typeface inspired by Cairo road signage.'
      );
      assert.equal(
        records.license.en,
        'This Font Software is licensed under the SIL Open Font License, Version 1.1. This license is available with a FAQ at: http://scripts.sil.org/OFL'
      );
      assert.equal(records.licenseURL.en, 'http://scripts.sil.org/OFL');
      assert.equal(records.preferredFamily.en, 'Mada');
      assert.equal(records.preferredSubfamily.en, 'Medium');
    });

    it('aliases standard names onto fontFeatures by id', function () {
      assert.strictEqual(records.fontFeatures[1], records.fontFamily);
      assert.strictEqual(records.fontFeatures[2], records.fontSubfamily);
      assert.strictEqual(records.fontFeatures[17], records.preferredSubfamily);
      assert.equal(records.fontFeatures[2].en, 'Regular');
    });
  });

  describe('name ID mapping', function () {
    function processRecords(rawRecords) {
      let table = { records: rawRecords };
      NameTable.process.call(table);
      return table.records;
    }

    function winEn(nameID, string) {
      return { platformID: 3, encodingID: 1, languageID: 0x409, nameID, string };
    }

    it('maps name IDs 18–25 to named keys aliased in fontFeatures', function () {
      let records = processRecords([
        winEn(18, 'Compatible Full'),
        winEn(19, 'Sample'),
        winEn(20, 'CIDName'),
        winEn(21, 'WWS Family'),
        winEn(22, 'WWS Subfamily'),
        winEn(23, 'Light Palette'),
        winEn(24, 'Dark Palette'),
        winEn(25, 'VarPrefix')
      ]);

      assert.equal(records.variationsPostScriptNamePrefix.en, 'VarPrefix');
      assert.strictEqual(records.fontFeatures[25], records.variationsPostScriptNamePrefix);
      assert.strictEqual(records.fontFeatures[23], records.lightBackgroundPalette);
    });

    it('groups reserved name IDs 15 and 26–255 under reservedNameID', function () {
      let records = processRecords([
        winEn(15, 'Reserved fifteen'),
        winEn(26, 'Future'),
        winEn(255, 'Also reserved')
      ]);

      assert.equal(records.reservedNameID[15].en, 'Reserved fifteen');
      assert.strictEqual(records.fontFeatures[15], records.reservedNameID[15]);
      assert.strictEqual(records.fontFeatures[26], records.reservedNameID[26]);
      assert.equal(records[15], undefined);
    });

    it('preEncode writes standard, reserved, and font-specific IDs without duplicating mirrors', function () {
      let table = {
        records: {
          fontFamily: { en: 'Family' },
          postscriptName: { en: 'Family-Regular' },
          reservedNameID: { 15: { en: 'R15' }, 26: { en: 'R26' } },
          fontFeatures: {
            1: { en: 'Family' },
            15: { en: 'R15' },
            26: { en: 'R26' },
            256: { en: 'Feature' }
          }
        }
      };

      let origSize = NameTable.size;
      NameTable.size = () => 0;
      try {
        NameTable.preEncode.call(table);
      } finally {
        NameTable.size = origSize;
      }

      let counts = {};
      for (let rec of table.records) {
        counts[rec.nameID] = (counts[rec.nameID] || 0) + 1;
      }

      assert.equal(counts[1], 1);
      assert.equal(counts[6], 2); // Windows + Mac PostScript
      assert.equal(counts[15], 1);
      assert.equal(counts[26], 1);
      assert.equal(counts[256], 1);
    });
  });
});

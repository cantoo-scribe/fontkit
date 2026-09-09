import * as fontkit from 'fontkit';
import assert from 'assert';
import * as r from 'restructure';
import fs from 'fs';

describe('font subsetting', function () {
  describe('truetype subsetting', function () {
    let font = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));

    it('should produce a subset', function () {
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('hello')) {
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      let f = fontkit.create(buf);
      assert.equal(f.numGlyphs, 5);
      assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('h')[0].path.toSVG());
    });

    it.skipIf(!fs.existsSync('/Library/Fonts/Skia.ttf'))('should re-encode variation glyphs', function () {
      let font = fontkit.openSync('/Library/Fonts/Skia.ttf', 'Bold');
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('e')) {
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      let f = fontkit.create(buf);
      assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('e')[0].path.toSVG());
    });

    it('should handle composite glyphs', function () {
      let subset = font.createSubset();
      subset.includeGlyph(font.glyphsForString('é')[0]);

      let buf = subset.encode();
      let f = fontkit.create(buf);
      assert.equal(f.numGlyphs, 4);
      assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('é')[0].path.toSVG());
    });

    it('should handle fonts with long index to location format (indexToLocFormat = 1)', function () {
      let font = fontkit.openSync(new URL('data/FiraSans/FiraSans-Regular.ttf', import.meta.url));
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('abcd')) {
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      let f = fontkit.create(buf);
      assert.equal(f.numGlyphs, 5);
      assert.equal(f.getGlyph(1).path.toSVG(), font.glyphsForString('a')[0].path.toSVG());
      // must test also second glyph which has an odd loca index
      assert.equal(f.getGlyph(2).path.toSVG(), font.glyphsForString('b')[0].path.toSVG());
    });

    it('should produce a subset including font table OS/2', function () {
      let subset = font.createSubset();
      for (let glyph of font.glyphsForString('hello')) {
        subset.includeGlyph(glyph);
      }
      subset.includeTable('OS/2');

      let buf = subset.encode();
      let f = fontkit.create(buf);
      assert.ok(f.directory.tables['OS/2']);
      assert.equal(f['OS/2'].achVendID, font['OS/2'].achVendID);
      assert.equal(f['OS/2'].usWeightClass, font['OS/2'].usWeightClass);
    });

    it('should reject invalid or unsafe includeTable tags', function () {
      let subset = font.createSubset();

      assert.throws(() => subset.includeTable('cvt'), /4 characters/);
      assert.throws(() => subset.includeTable('glyf'), /already managed/);
      assert.throws(() => subset.includeTable('ZZZZ'), /not present/);

      subset.includeTable('OS/2');
      subset.includeTable('OS/2'); // idempotent
      assert.deepEqual(subset.includedTables, ['OS/2']);
    });
  });

  describe('CFF subsetting', function () {
    let font = fontkit.openSync(new URL('data/SourceSansPro/SourceSansPro-Regular.otf', import.meta.url));

    it('should reject includeTable on CFF subsets', function () {
      let subset = font.createSubset();
      assert.throws(() => subset.includeTable('OS/2'), /only supported for TrueType/);
    });

    it('should produce a subset', function () {
      let subset = font.createSubset();
      let iterable = font.glyphsForString('hello');
      for (let i = 0; i < iterable.length; i++) {
        let glyph = iterable[i];
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      let stream = new r.DecodeStream(buf);
      let CFFFont = font._tables['CFF '].constructor;
      let CFFGlyph = iterable[0].constructor;
      let cff = new CFFFont(stream);
      let glyph = new CFFGlyph(1, [], { stream, 'CFF ': cff });
      assert.equal(glyph.path.toSVG(), font.glyphsForString('h')[0].path.toSVG());
    });

    it('should handle CID fonts', function () {
      let f = fontkit.openSync(new URL('data/NotoSansCJK/NotoSansCJKkr-Regular.otf', import.meta.url));
      let subset = f.createSubset();
      let iterable = f.glyphsForString('갈휸');
      for (let i = 0; i < iterable.length; i++) {
        let glyph = iterable[i];
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      let stream = new r.DecodeStream(buf);
      let CFFFont = font._tables['CFF '].constructor;
      let CFFGlyph = iterable[0].constructor;
      let cff = new CFFFont(stream);
      let glyph = new CFFGlyph(1, [], { stream, 'CFF ': cff });
      assert.equal(glyph.path.toSVG(), f.glyphsForString('갈')[0].path.toSVG());
      assert.equal(cff.topDict.FDArray.length, 2);
      assert.deepEqual(cff.topDict.FDSelect.fds, [0, 1, 1]);
    });

    it('should produce a subset with asian punctuation corretly', function () {
      const koreanFont = fontkit.openSync(new URL('data/NotoSansCJK/NotoSansCJKkr-Regular.otf', import.meta.url));
      const subset = koreanFont.createSubset();
      const iterable = koreanFont.glyphsForString('a。d');
      for (let i = 0; i < iterable.length; i++) {
        const glyph = iterable[i];
        subset.includeGlyph(glyph);
      }

      let buf = subset.encode();
      const stream = new r.DecodeStream(buf);
      let CFFFont = font._tables['CFF '].constructor;
      let CFFGlyph = iterable[0].constructor;
      const cff = new CFFFont(stream);
      let glyph = new CFFGlyph(1, [], { stream, 'CFF ': cff });
      assert.equal(glyph.path.toSVG(), koreanFont.glyphsForString('a')[0].path.toSVG());
      glyph = new CFFGlyph(2, [], { stream, 'CFF ': cff });
      assert.equal(glyph.path.toSVG(), koreanFont.glyphsForString('。')[0].path.toSVG());
      glyph = new CFFGlyph(3, [], { stream, 'CFF ': cff });
      assert.equal(glyph.path.toSVG(), koreanFont.glyphsForString('d')[0].path.toSVG());
    });

    it('should encode a notdef-only subset without an invalid charset range', function () {
      let subset = font.createSubset();
      let buf = subset.encode();
      let stream = new r.DecodeStream(buf);
      let CFFFont = font._tables['CFF '].constructor;
      let cff = new CFFFont(stream);
      assert.equal(cff.topDict.CharStrings.length, 1);
      assert.deepEqual(cff.topDict.charset.ranges, []);
    });
  });
});

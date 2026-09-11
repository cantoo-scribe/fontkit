import assert from 'assert';
import * as fontkit from '../src/node.js';
import { cloneDeep, deepEqual } from '../src/utils.js';
import { ISOAdobeCharset } from '../src/cff/CFFCharsets.js';
import { StandardEncoding } from '../src/cff/CFFEncodings.js';

describe('utils cloneDeep / deepEqual', function () {
  let font;

  beforeAll(function () {
    font = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
  });

  it('cloneDeep isolates mutated OT table fields used by subsetting', function () {
    const maxp = cloneDeep(font.maxp);
    const head = cloneDeep(font.head);
    const hhea = cloneDeep(font.hhea);
    const os2 = cloneDeep(font['OS/2']);

    assert.notStrictEqual(maxp, font.maxp);
    assert.notStrictEqual(head, font.head);
    assert.notStrictEqual(hhea, font.hhea);
    assert.notStrictEqual(os2, font['OS/2']);

    const origNumGlyphs = font.maxp.numGlyphs;
    const origIndexToLoc = font.head.indexToLocFormat;
    const origNumberOfMetrics = font.hhea.numberOfMetrics;

    maxp.numGlyphs = 1;
    head.indexToLocFormat = 99;
    hhea.numberOfMetrics = 1;

    assert.strictEqual(font.maxp.numGlyphs, origNumGlyphs);
    assert.strictEqual(font.head.indexToLocFormat, origIndexToLoc);
    assert.strictEqual(font.hhea.numberOfMetrics, origNumberOfMetrics);
    assert.strictEqual(typeof os2.usWeightClass, 'number');
  });

  it('cloneDeep preserves nullish inputs used by subset encode', function () {
    assert.strictEqual(cloneDeep(null), null);
    assert.strictEqual(cloneDeep(undefined), undefined);
  });

  it('deepEqual matches CFF default shapes', function () {
    assert.ok(deepEqual([0.001, 0, 0, 0.001, 0, 0], [0.001, 0, 0, 0.001, 0, 0]));
    assert.ok(deepEqual([0, 0, 0, 0], [0, 0, 0, 0]));
    assert.ok(deepEqual(false, false));
    assert.ok(!deepEqual(false, 0));
    assert.ok(deepEqual(null, null));
    assert.ok(!deepEqual(null, undefined));
    assert.ok(deepEqual(0.039625, 0.039625));
    assert.ok(deepEqual(ISOAdobeCharset, ISOAdobeCharset));
    assert.ok(deepEqual(ISOAdobeCharset, [...ISOAdobeCharset]));
    assert.ok(deepEqual(StandardEncoding, [...StandardEncoding]));
    assert.ok(!deepEqual([0.001, 0, 0, 0.001, 0, 0], [0.001, 0, 0, 0.001, 0, 1]));
  });

  it('subset encode still works after helper swap', function () {
    const subset = font.createSubset();
    for (const glyph of font.glyphsForString('Hi')) {
      subset.includeGlyph(glyph);
    }
    subset.includeTable('OS/2');
    const buf = subset.encode();
    assert.ok(buf.byteLength > 100);
    const opened = fontkit.create(buf);
    assert.ok(opened.numGlyphs >= 2);
  });
});

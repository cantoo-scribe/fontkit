import assert from 'assert';
import * as fontkit from '../src/node.js';
import { defineCached } from '../src/decorators.js';
import { cloneDeep } from '../src/utils.js';

describe('defineCached (ex-@cache)', function () {
  it('caches getters once per instance, including falsy values', function () {
    let calls = 0;
    class A {
      get value() {
        calls++;
        return { n: calls };
      }

      get zero() {
        return 0;
      }

      get empty() {
        return '';
      }

      get no() {
        return false;
      }

      get nada() {
        return null;
      }
    }
    defineCached(A.prototype, ['value', 'zero', 'empty', 'no', 'nada']);

    const a = new A();
    assert.strictEqual(a.value, a.value);
    assert.strictEqual(calls, 1);
    assert.strictEqual(a.zero, 0);
    assert.strictEqual(a.empty, '');
    assert.strictEqual(a.no, false);
    assert.strictEqual(a.nada, null);

    const b = new A();
    assert.notStrictEqual(a.value, b.value);
    assert.strictEqual(calls, 2);
  });

  it('memoizes methods by first argument (legacy @cache semantics)', function () {
    let calls = 0;
    class M {
      compute(x, y) {
        calls++;
        return [x, y];
      }
    }
    defineCached(M.prototype, ['compute']);
    const m = new M();
    const first = m.compute(1, 10);
    assert.strictEqual(m.compute(1, 99), first); // 2nd arg ignored once cached
    assert.deepStrictEqual(m.compute(2, 1), [2, 1]);
    assert.strictEqual(calls, 2);
  });

  it('keeps glyph metrics/path identity across repeated access', function () {
    const font = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
    const g = font.glyphForCodePoint(0x41);
    assert.strictEqual(g.path, g.path);
    assert.strictEqual(g.bbox, g.bbox);
    assert.strictEqual(g.advanceWidth, g.advanceWidth);
    assert.ok(g.advanceWidth > 0);
    assert.ok(g.path.commands.length > 0);
  });

  it('does not share cache across font instances', function () {
    const a = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
    const b = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
    assert.notStrictEqual(a.bbox, b.bbox);
    assert.notStrictEqual(a._cmapProcessor, b._cmapProcessor);
    assert.deepStrictEqual(a.characterSet.slice(0, 5), b.characterSet.slice(0, 5));
  });

  it('memoizes codePointsForGlyph per gid', function () {
    const font = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
    const gid = font.glyphForCodePoint(0x41).id;
    const cps = font._cmapProcessor.codePointsForGlyph(gid);
    assert.strictEqual(font._cmapProcessor.codePointsForGlyph(gid), cps);
    assert.ok(cps.includes(0x41));
  });
});

describe('cloneDeep (ex-clone package)', function () {
  it('isolates mutated subset table fields', function () {
    const font = fontkit.openSync(new URL('data/OpenSans/OpenSans-Regular.ttf', import.meta.url));
    const maxp = cloneDeep(font.maxp);
    const head = cloneDeep(font.head);
    const origGlyphs = font.maxp.numGlyphs;
    const origFormat = font.head.indexToLocFormat;

    maxp.numGlyphs = 1;
    head.indexToLocFormat = 99;

    assert.strictEqual(font.maxp.numGlyphs, origGlyphs);
    assert.strictEqual(font.head.indexToLocFormat, origFormat);
    assert.notStrictEqual(maxp, font.maxp);
  });

  it('handles nullish like subset encode may see', function () {
    assert.strictEqual(cloneDeep(null), null);
    assert.strictEqual(cloneDeep(undefined), undefined);
  });
});

/**
 * Public TypeScript API for `@cantoo/fontkit`.
 * Built for consumers; internal checkJs types live in `./fontkit.d.ts`.
 */

export type ScriptTag = string;
export type LanguageTag = string;
export type TextDirection = 'ltr' | 'rtl';
export type FeatureValue = boolean | number;
export type FeatureMap = Record<string, FeatureValue>;
export type FeatureInput = string[] | FeatureMap;

/** Bounding box in font units. */
export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  readonly width: number;
  readonly height: number;
  addPoint(x: number, y: number): void;
  copy(): BBox;
}

/** Vector path command. */
export interface PathCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath';
  args: number[];
}

/** Minimal canvas-like context used by Path.toFunction / Glyph.render. */
export interface PathRenderingContext {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fill(): void;
  moveTo?(x: number, y: number): void;
  lineTo?(x: number, y: number): void;
  quadraticCurveTo?(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo?(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): void;
  closePath?(): void;
  [key: string]: unknown;
}

/** Outline path returned by glyphs. */
export interface Path {
  commands: PathCommand[];
  readonly cbox: BBox;
  readonly bbox: BBox;
  toFunction(): (ctx: PathRenderingContext) => void;
  toSVG(): string;
  mapPoints(fn: (x: number, y: number) => [number, number]): Path;
  transform(m0: number, m1: number, m2: number, m3: number, m4: number, m5: number): Path;
  translate(x: number, y: number): Path;
  rotate(angle: number): Path;
  scale(scaleX: number, scaleY?: number): Path;
  moveTo(x: number, y: number): Path;
  lineTo(x: number, y: number): Path;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): Path;
  bezierCurveTo(
    cp1x: number,
    cp1y: number,
    cp2x: number,
    cp2y: number,
    x: number,
    y: number
  ): Path;
  closePath(): Path;
}

/** Per-glyph advance / bearing metrics. */
export interface GlyphMetrics {
  width: number;
  height: number;
  advanceWidth: number;
  advanceHeight: number;
  leftBearing: number;
  topBearing: number;
  rightBearing: number;
  bottomBearing: number;
}

/** A glyph in a font. */
export interface Glyph {
  id: number;
  codePoints: number[];
  isMark: boolean;
  isLigature: boolean;
  readonly cbox: BBox;
  readonly bbox: BBox;
  readonly path: Path;
  readonly width: number;
  readonly height: number;
  readonly advanceWidth: number;
  readonly advanceHeight: number;
  readonly leftBearing: number;
  readonly topBearing: number;
  readonly rightBearing: number;
  readonly bottomBearing: number;
  readonly name: string | null;
  getScaledPath(size: number): Path;
  render(ctx: PathRenderingContext, size: number): void;
}

/** Positioning for one glyph in a GlyphRun. */
export interface GlyphPosition {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

/** Result of Font.layout(). */
export interface GlyphRun {
  glyphs: Glyph[];
  positions: GlyphPosition[] | null;
  script: ScriptTag | string[] | null | undefined;
  language: LanguageTag | null;
  direction: TextDirection;
  features: FeatureMap;
  readonly advanceWidth: number;
  readonly advanceHeight: number;
  readonly bbox: BBox;
}

/** Variation axis description. */
export interface VariationAxisInfo {
  name: string | null;
  min: number;
  default: number;
  max: number;
}

/** Font subset writer (sync encode only in @cantoo/fontkit). */
export interface Subset {
  includeGlyph(glyph: Glyph | number): number;
  /** Encode the subset as a font buffer (synchronous). */
  encode(): Uint8Array;
}

/**
 * An opened single font face (TTF / OTF / WOFF / WOFF2).
 */
export interface Font {
  type: string;
  readonly postscriptName: string | null;
  readonly fullName: string | null;
  readonly familyName: string | null;
  readonly subfamilyName: string | null;
  readonly copyright: string | null;
  readonly version: string | null;
  readonly unitsPerEm: number;
  readonly ascent: number;
  readonly descent: number;
  readonly lineGap: number;
  readonly underlinePosition: number;
  readonly underlineThickness: number;
  readonly italicAngle: number;
  readonly capHeight: number;
  readonly xHeight: number;
  readonly bbox: BBox;
  readonly numGlyphs: number;
  readonly characterSet: number[];
  readonly availableFeatures: string[];
  readonly variationAxes: Record<string, VariationAxisInfo>;
  readonly namedVariations: Record<string, Record<string, number>>;

  setDefaultLanguage(lang?: string | null): void;
  getName(key: string, lang?: string): string | null;
  hasGlyphForCodePoint(codePoint: number): boolean;
  glyphForCodePoint(codePoint: number): Glyph | null;
  glyphsForString(string: string): Glyph[];
  layout(
    string: string,
    userFeatures?: FeatureInput | null,
    script?: ScriptTag | string[] | null,
    language?: LanguageTag | null,
    direction?: TextDirection | null
  ): GlyphRun;
  stringsForGlyph(gid: number): string[];
  getAvailableFeatures(
    script?: ScriptTag | string[] | null,
    language?: LanguageTag | null
  ): string[];
  getGlyph(glyph: number, characters?: number[]): Glyph | null;
  createSubset(): Subset;
  getVariation(variation: string | Record<string, number> | number[]): Font;
}

/**
 * A TrueType Collection (TTC) or Mac DFont container.
 */
export interface FontCollection {
  type: 'TTC' | 'DFont' | string;
  readonly fonts: Font[];
  getFont(postscriptName: string | Uint8Array): Font | null;
}

/** Constructible font format registered with registerFormat(). */
export interface FontFormat {
  new (stream: unknown, variationCoords?: number[] | null): Font | FontCollection;
  probe(buffer: ArrayBufferView): boolean;
}

export declare let logErrors: boolean;
export declare let defaultLanguage: string;

export declare function registerFormat(format: FontFormat): void;
export declare function setDefaultLanguage(lang?: string): void;

/** Open a font or collection from a buffer (no face selected). */
export declare function create(buffer: ArrayBufferView): Font | FontCollection;
/** Open a buffer and select a face by PostScript name. */
export declare function create(
  buffer: ArrayBufferView,
  postscriptName: string | Uint8Array
): Font | null;

/** Node-only: open a font file asynchronously. */
export declare function open(filename: string | import('fs').PathLike): Promise<Font | FontCollection>;
export declare function open(
  filename: string | import('fs').PathLike,
  postscriptName: string | Uint8Array
): Promise<Font | null>;

/** Node-only: open a font file synchronously. */
export declare function openSync(filename: string | import('fs').PathLike): Font | FontCollection;
export declare function openSync(
  filename: string | import('fs').PathLike,
  postscriptName: string | Uint8Array
): Font | null;

declare const fontkit: {
  logErrors: boolean;
  defaultLanguage: string;
  registerFormat: typeof registerFormat;
  create: typeof create;
  setDefaultLanguage: typeof setDefaultLanguage;
  open: typeof open;
  openSync: typeof openSync;
};

export default fontkit;

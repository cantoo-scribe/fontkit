/**
 * Shared domain types for fontkit.
 * Referenced from JSDoc via `import('...').Name` or global aliases below.
 */

import type {
  DecodeStream,
  EncodeStream,
  StructValue,
  BinaryBuffer,
  BaseType
} from 'restructure';

export type { DecodeStream, EncodeStream, StructValue, BinaryBuffer, BaseType };

/** OpenType script tag (4-char string, may include trailing spaces). */
export type ScriptTag = string;

/** OpenType language tag. */
export type LanguageTag = string;

/** Text direction used by the layout engine. */
export type TextDirection = 'ltr' | 'rtl';

/** Feature value: boolean enable, or 1-based alternate index (e.g. aalt). */
export type FeatureValue = boolean | number;

/** Feature map: feature tag → enabled or alternate index. */
export type FeatureMap = Record<string, FeatureValue>;

/** Features may be passed as tags or as an enable/value map. */
export type FeatureInput = string[] | FeatureMap;

/** Variation axis coordinates keyed by axis tag. */
export type VariationCoords = Record<string, number> | number[] | null;

/** Directory entry for an SFNT table (includes WOFF/WOFF2 fields). */
export interface TableEntry {
  tag: string;
  checksum?: number;
  checkSum?: number;
  offset: number;
  length: number;
  /** WOFF compressed length. */
  compLength?: number;
  /** WOFF2 transform metadata. */
  transformLength?: number;
  transformed?: boolean;
}

/** Decoded SFNT / WOFF / WOFF2 directory. */
export interface FontDirectory {
  tag?: string;
  numTables?: number;
  tables: Record<string, TableEntry>;
  /** WOFF2 total compressed payload size. */
  totalCompressedSize?: number;
  flavor?: number;
  length?: number;
}

/** Glyph metrics bundle returned by Glyph._getMetrics. */
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

/** Font-level metrics from hhea/OS/2. */
export interface FontMetrics {
  ascent: number;
  descent: number;
  lineGap: number;
  lineHeight: number;
}

/** Path drawing command. */
export interface PathCommand {
  command: 'moveTo' | 'lineTo' | 'quadraticCurveTo' | 'bezierCurveTo' | 'closePath';
  args: number[];
}

/** Minimal canvas-like context used by Glyph.render / Path.toFunction. */
export interface PathRenderingContext {
  save(): void;
  restore(): void;
  scale(x: number, y: number): void;
  fill(): void;
  moveTo?(x: number, y: number): void;
  lineTo?(x: number, y: number): void;
  quadraticCurveTo?(cpx: number, cpy: number, x: number, y: number): void;
  bezierCurveTo?(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
  closePath?(): void;
  /** PDFKit-style fill used by COLR glyphs. */
  fillColor?(rgb: [number, number, number] | number[], alphaPercent?: number): void;
  /** PDFKit-style image draw used by SBIX glyphs. */
  image?(data: BinaryBuffer | unknown, options?: { height?: number; x?: number; y?: number }): void;
  [key: string]: unknown;
}

/** Single horizontal/vertical metric entry from hmtx/vmtx. */
export interface HmtxMetric {
  advance: number;
  bearing: number;
}

/** Lazy array surface used by hmtx/vmtx. */
export interface LazyMetricArray<T> {
  length: number;
  get(index: number): T | undefined;
}

/** Decoded hmtx or vmtx table. */
export interface MetricsTable {
  metrics: LazyMetricArray<HmtxMetric>;
  bearings: LazyMetricArray<number>;
}

/** head table fields used by glyphs and font metrics. */
export interface HeadTable {
  unitsPerEm: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  indexToLocFormat?: number;
}

/** Horizontal header table. */
export interface HheaTable {
  ascent: number;
  descent: number;
  lineGap: number;
  numberOfMetrics: number;
  advanceWidthMax?: number;
}

/** Maximum profile table. */
export interface MaxpTable {
  numGlyphs: number;
  version?: number;
}

/** OS/2 selection flags used for metrics. */
export interface OS2FsSelection {
  useTypoMetrics?: boolean;
  italic?: boolean;
  bold?: boolean;
  [flag: string]: boolean | undefined;
}

/** OS/2 table (fields vary by version). */
export interface OS2Table {
  version: number;
  fsSelection: OS2FsSelection;
  typoAscender?: number;
  typoDescender?: number;
  typoLineGap?: number;
  winAscent?: number;
  winDescent?: number;
  capHeight?: number;
  xHeight?: number;
}

/** Localized name strings keyed by BCP-47 / platform language id. */
export type NameLocaleMap = Record<string, string | BinaryBuffer | undefined>;

/** Decoded `name` table records map (after NameTable.process). */
export interface NameRecords {
  fontFeatures?: Record<string | number, NameLocaleMap>;
  reservedNameID?: Record<string | number, NameLocaleMap>;
  copyright?: NameLocaleMap;
  fontFamily?: NameLocaleMap;
  fontSubfamily?: NameLocaleMap;
  fullName?: NameLocaleMap;
  postscriptName?: NameLocaleMap;
  version?: NameLocaleMap;
  [key: string]: NameLocaleMap | Record<string | number, NameLocaleMap> | undefined;
}

/** Name table surface used by TTFFont.getName. */
export interface NameTable {
  records: NameRecords;
}

/** Value stored in a name record (decoded string or raw bytes). */
export type NameString = string | BinaryBuffer;

/** post table glyph naming / underline fields. */
export interface PostTable {
  version: number;
  italicAngle: number;
  underlinePosition: number;
  underlineThickness: number;
  glyphNameIndex?: number[];
  names?: string[];
  offsets?: number[];
  map?: number[];
}

/** loca glyph offsets. */
export interface LocaTable {
  offsets: number[];
  version?: number;
}

/** Lazy number array surface from restructure LazyArray. */
export interface LazyNumberArray {
  length: number;
  get(index: number): number | undefined;
  toArray(): number[];
}

/** cmap coverage group (formats 12/13). */
export interface CmapGroup {
  startCharCode: number;
  endCharCode: number;
  glyphID: number;
}

export interface LazyCmapGroupArray {
  length: number;
  get(index: number): CmapGroup | undefined;
  toArray(): CmapGroup[];
}

export interface CmapDefaultUVSRange {
  startUnicodeValue: number;
  additionalCount: number;
}

export interface CmapUVSMapping {
  unicodeValue: number;
  glyphID: number;
}

export interface CmapVarSelector {
  varSelector: number;
  defaultUVS?: CmapDefaultUVSRange[] | null;
  nonDefaultUVS?: CmapUVSMapping[] | null;
}

export interface LazyVarSelectorArray {
  length: number;
  get(index: number): CmapVarSelector | undefined;
  toArray(): CmapVarSelector[];
}

/** Discriminated cmap subtable formats used by CmapProcessor. */
export interface CmapSubtable0 {
  version: 0;
  language: number;
  codeMap: LazyNumberArray;
}

export interface CmapSubtable4 {
  version: 4;
  language: number;
  segCount: number;
  endCode: LazyNumberArray;
  startCode: LazyNumberArray;
  idDelta: LazyNumberArray;
  idRangeOffset: LazyNumberArray;
  glyphIndexArray: LazyNumberArray;
}

export interface CmapSubtable6 {
  version: 6;
  language: number;
  firstCode: number;
  glyphIndices: LazyNumberArray;
}

export interface CmapSubtable8 {
  version: 8;
  language: number;
}

export interface CmapSubtable10 {
  version: 10;
  language: number;
  firstCode: number;
  glyphIndices: LazyNumberArray;
}

export interface CmapSubtable12 {
  version: 12;
  language: number;
  nGroups: number;
  groups: LazyCmapGroupArray;
}

export interface CmapSubtable13 {
  version: 13;
  language: number;
  nGroups: number;
  groups: LazyCmapGroupArray;
}

export interface CmapSubtable14 {
  version: 14;
  varSelectors: LazyVarSelectorArray;
}

export type CmapSubtable =
  | CmapSubtable0
  | CmapSubtable4
  | CmapSubtable6
  | CmapSubtable8
  | CmapSubtable10
  | CmapSubtable12
  | CmapSubtable13
  | CmapSubtable14;

export interface CmapTableEntry {
  platformID: number;
  encodingID: number;
  table: CmapSubtable;
}

/** Top-level cmap table. */
export interface CmapTable {
  version?: number;
  numSubtables?: number;
  tables: CmapTableEntry[];
}

/** CPAL palette color. */
export interface CPALColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

export interface COLRBaseGlyphRecord {
  gid: number;
  firstLayerIndex: number;
  numLayers: number;
}

export interface COLRLayerRecord {
  gid: number;
  paletteIndex: number;
}

export interface COLRTable {
  version?: number;
  baseGlyphRecord?: COLRBaseGlyphRecord[] | null;
  layerRecords: COLRLayerRecord[];
}

export interface CPALTable {
  colorRecords: CPALColor[];
}

export interface SBIXImageTable {
  ppem: number;
  resolution?: number;
  imageOffsets: number[];
}

export interface SBIXTable {
  imageTables: SBIXImageTable[];
  flags: { renderOutlines: boolean };
}

export interface SBIXImage {
  originX: number;
  originY: number;
  type: string;
  data: BinaryBuffer;
}

export interface FvarAxis {
  axisTag: string;
  minValue: number;
  defaultValue: number;
  maxValue: number;
  name?: NameLocaleMap;
}

export interface FvarInstance {
  name: NameLocaleMap;
  coord: number[];
}

export interface FvarTable {
  axis: FvarAxis[];
  instance: FvarInstance[];
}

export interface AvarCorrespondence {
  fromCoord: number;
  toCoord: number;
}

export interface AvarSegment {
  correspondence: AvarCorrespondence[];
}

export interface AvarTable {
  segment: AvarSegment[];
}

export interface GvarTable {
  glyphCount: number;
  offsets: number[];
  axisCount: number;
  globalCoordCount: number;
  globalCoords: number[][];
}

export interface ItemVariationRegionAxis {
  startCoord: number;
  peakCoord: number;
  endCoord: number;
}

export interface ItemVariationDeltaSet {
  deltas: number[];
}

export interface ItemVariationData {
  deltaSets: ItemVariationDeltaSet[];
  regionIndexCount: number;
  regionIndexes: number[];
}

export interface ItemVariationStore {
  itemVariationData: ItemVariationData[];
  variationRegionList: {
    variationRegions: ItemVariationRegionAxis[][];
  };
}

export interface DeltaSetIndexMapEntry {
  outerIndex: number;
  innerIndex: number;
}

export interface DeltaSetIndexMap {
  mapCount: number;
  mapData: DeltaSetIndexMapEntry[];
}

export interface HVARTable {
  advanceWidthMapping?: DeltaSetIndexMap;
  itemVariationStore: ItemVariationStore;
}

/** Contour point used by TrueType / variation processing. */
export interface GlyphPoint {
  onCurve: boolean;
  endContour: boolean;
  x: number;
  y: number;
  copy(): GlyphPoint;
}

/** Composite glyph component. */
export interface GlyphComponent {
  glyphID: number;
  dx: number;
  dy: number;
  pos: number;
  scaleX: number;
  scaleY: number;
  scale01: number;
  scale10: number;
}

/** Decoded glyf (simple or composite), including variation phantoms. */
export interface DecodedGlyf {
  numberOfContours: number;
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
  points?: GlyphPoint[];
  components?: GlyphComponent[];
  phantomPoints?: GlyphPoint[];
  instructions?: number[];
}

export interface CFFCharString {
  offset: number;
  length: number;
}

export interface CFFPrivateDict {
  /** Decoded ranges, or raw charstring buffers after subsetting. */
  Subrs?: CFFCharString[] | BinaryBuffer[];
  nominalWidthX?: number;
  vsindex?: number;
  [key: string]: unknown;
}

export interface CFFTopDict {
  CharStrings: CFFCharString[] | unknown[];
  Private?: CFFPrivateDict | null;
  FDArray?: Array<StructValue & { Private?: CFFPrivateDict; FontName?: unknown }>;
  FDSelect?: StructValue & {
    version?: number;
    fds?: number[];
    ranges?: Array<{ first: number; fd: number; offset?: number }>;
    nRanges?: number;
    sentinel?: number;
  };
  charset?: unknown;
  Encoding?: unknown;
  FullName?: number | null;
  FamilyName?: number | null;
  ROS?: unknown;
  CIDCount?: number;
  vstore?: { itemVariationStore?: ItemVariationStore } | null;
  [key: string]: unknown;
}

/**
 * CFF / CFF2 font surface used by CFFGlyph and CFFSubset.
 * Optional members cover both decode-time getters and subset encode paths.
 */
export interface CFFFontLike {
  stream: DecodeStream;
  version?: number;
  hdrSize?: number;
  header?: unknown;
  isCIDFont?: boolean;
  topDict: CFFTopDict;
  topDictIndex?: StructValue[];
  nameIndex?: string[];
  stringIndex?: string[];
  globalSubrIndex?: CFFCharString[] | { length: number; [index: number]: CFFCharString | undefined };
  postscriptName?: string | null;
  getCharString?(glyph: number): BinaryBuffer;
  string?(sid: number | null | undefined): string | null;
  getGlyphName?(gid: number): string | null | undefined;
  fdForGlyph?(gid: number): number | null;
  privateDictForGlyph(gid: number): CFFPrivateDict | null | undefined;
}

/** Variation processor methods used from glyphs and GPOS. */
export interface GlyphVariationProcessorLike {
  normalizedCoords?: number[];
  getAdvanceAdjustment(gid: number, table: HVARTable): number;
  transformPoints(gid: number, points: GlyphPoint[]): void;
  getBlendVector(itemStore: ItemVariationStore, outerIndex: number): number[];
  getDelta(itemStore: ItemVariationStore, outerIndex: number, innerIndex: number): number;
}

/** Axis-aligned box used by glyph metrics / Unicode mark positioning. */
export interface BBoxLike {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  copy(): BBoxLike;
}

/**
 * Glyph surface referenced by FontLike without importing Glyph.js
 * (avoids circular type refs with TTFFont).
 */
export interface GlyphLike {
  id: number;
  codePoints?: number[];
  advanceWidth?: number;
  isMark?: boolean;
  isLigature?: boolean;
  cbox?: BBoxLike;
  bbox: { minX: number; minY: number; maxX: number; maxY: number; width?: number; height?: number };
  path: {
    commands: PathCommand[];
    translate(x: number, y: number): { commands: PathCommand[] };
    scale(scaleX: number, scaleY?: number): unknown;
  };
  render(ctx: PathRenderingContext, size: number): void;
  _getContours?(): GlyphPoint[][];
}

/** Glyph used during layout (TTF Glyph or similar). */
export interface LayoutGlyph extends GlyphLike {
  codePoints: number[];
  advanceWidth: number;
}

/**
 * Partial glyf payload produced by WOFF2 `_transformGlyfTable`
 * (bbox filled in later by WOFF2Glyph._decode when needed).
 */
export type TransformedGlyf = Pick<DecodedGlyf, 'numberOfContours'> &
  Partial<Omit<DecodedGlyf, 'numberOfContours'>>;

/**
 * Minimal font surface used by Glyph and subclasses.
 * Prefer this over importing TTFFont to avoid circular refs.
 * SFNT tables are optional on the type when installed as lazy getters.
 */
export interface FontLike {
  stream: DecodeStream;
  directory: FontDirectory;
  unitsPerEm: number;
  ascent: number;
  descent: number;
  numGlyphs: number;
  variationCoords?: VariationCoords;
  cmap?: CmapTable;
  head: HeadTable;
  hhea?: HheaTable;
  hmtx: MetricsTable;
  maxp?: MaxpTable;
  name?: NameTable;
  'OS/2'?: OS2Table;
  post?: PostTable;
  loca?: LocaTable;
  glyf?: unknown;
  vmtx?: MetricsTable;
  vhea?: StructValue;
  HVAR?: HVARTable;
  fvar?: FvarTable;
  avar?: AvarTable;
  gvar?: GvarTable;
  sbix?: SBIXTable;
  COLR?: COLRTable;
  CPAL?: CPALTable;
  CBLC?: StructValue;
  EBLC?: StructValue;
  CFF2?: CFFFontLike;
  'CFF '?: CFFFontLike;
  GSUB?: OTLayoutTable;
  GPOS?: OTLayoutTable;
  GDEF?: GDEFTable;
  kern?: KernTable;
  morx?: MorxTable;
  prep?: unknown;
  fpgm?: unknown;
  'cvt '?: unknown;
  _variationProcessor?: GlyphVariationProcessorLike | null;
  _transformedGlyphs?: (TransformedGlyf | undefined)[];
  _decompress?(): void;
  _getTableStream(tag: string): DecodeStream | null;
  _getBaseGlyph(glyph: number, characters?: number[]): GlyphLike | null | undefined;
  getGlyph(glyph: number, characters?: number[]): LayoutGlyph | null;
  hasGlyphForCodePoint?(codePoint: number): boolean;
  glyphsForString?(string: string): LayoutGlyph[];
  glyphForCodePoint?(codePoint: number): LayoutGlyph | null;
  _cmapProcessor?: {
    codePointsForGlyph(gid: number): number[];
    lookup(codePoint: number, variationSelector?: number): number;
  };
  _layoutEngine?: LayoutEngineHost;
}

/** Font surface required by layout / OpenType processors. */
export interface LayoutFont extends FontLike {
  glyphsForString(string: string): LayoutGlyph[];
  glyphForCodePoint(codePoint: number): LayoutGlyph | null;
  hasGlyphForCodePoint(codePoint: number): boolean;
  getGlyph(glyph: number, characters?: number[]): LayoutGlyph | null;
  _cmapProcessor: {
    codePointsForGlyph(gid: number): number[];
    lookup(codePoint: number, variationSelector?: number): number;
  };
  _layoutEngine: LayoutEngineHost;
}

/** Map of OpenType table tag → decoded table object. */
export type DecodedTables = Record<string, StructValue | undefined>;

/** Table codec registry entry. */
export interface TableCodec {
  decode(stream: DecodeStream, font?: unknown, length?: number): unknown;
  encode?(stream: EncodeStream, value?: unknown, font?: unknown): unknown;
  size?(value?: unknown, font?: unknown): number;
}

/** Font or collection instance returned by create() / open(). */
export interface OpenedFont {
  getFont(
    postscriptName: string | Uint8Array | Record<string, number>
  ): OpenedFont | null | undefined;
}

/** Registered font format: constructible from a DecodeStream with a static probe. */
export interface FontFormat {
  new (stream: DecodeStream, variationCoords?: number[] | null): OpenedFont;
  probe(buffer: ArrayBufferView): boolean;
}

/** CFF dict operator key: single byte or two-byte escape. */
export type CFFOpKey = number | [number, number];

/**
 * Operand type for a CFF dict operator: a named primitive, a codec, or a
 * parallel list of operand types (e.g. ROS = sid + sid + number).
 */
export type CFFOperandType =
  | 'number'
  | 'offset'
  | 'sid'
  | 'boolean'
  | 'array'
  | 'delta'
  | BaseType
  | CFFOperandType[];

/** One CFF dict field: [key, name, type, defaultValue]. */
export type CFFDictField = [CFFOpKey, string, CFFOperandType, unknown];

/** Context used while sizing/encoding CFF dicts and pointers. */
export interface CFFEncodeContext extends StructValue {
  pointers: Array<{ type: BaseType; val: unknown; parent: StructValue }>;
  startOffset: number;
  pointerSize: number;
  pointerOffset?: number;
  val?: unknown;
}

/** Glyph object surface used by subsetters. */
export interface SubsetGlyph {
  id: number;
  path: unknown;
  advanceWidth: number;
  _usedGsubrs?: Record<string, boolean>;
  _usedSubrs?: Record<string, boolean>;
  _decode?(): DecodedGlyf | null;
  _getMetrics(): GlyphMetrics;
}

/**
 * Minimal font surface required by Subset / TTFSubset / CFFSubset.
 * Intentionally structural so TTFFont (and friends) satisfy it without casts.
 */
export interface SubsetFont {
  directory: FontDirectory;
  getGlyph(glyph: number, characters?: number[]): SubsetGlyph | null;
  _getTableStream(tag: string): DecodeStream | null;
  _variationProcessor?: unknown;
  loca?: { offsets: number[]; version?: number };
  maxp?: MaxpTable | StructValue;
  head?: HeadTable | StructValue;
  hhea?: HheaTable | StructValue;
  prep?: unknown;
  fpgm?: unknown;
  'cvt '?: unknown;
  'CFF '?: CFFFontLike;
  CFF2?: CFFFontLike;
}

// ---------------------------------------------------------------------------
// OpenType layout (GSUB / GPOS / GDEF) and kerning
// ---------------------------------------------------------------------------

/** Lazy random-access list (restructure LazyArray surface). */
export interface LazyList<T> {
  get(index: number): T;
  length?: number;
}

/** Coverage table (format 1 glyphs list / format 2 ranges). */
export interface CoverageTable {
  version: number;
  glyphs?: number[];
  rangeRecords?: Array<{ start: number; end: number; startCoverageIndex: number }>;
}

/** ClassDef table. */
export interface ClassDefTable {
  version: number;
  startGlyph?: number;
  classValueArray?: number[];
  classRangeRecord?: Array<{ start: number; end: number; class: number }>;
}

/** Device / variation index pair used by GPOS anchors and value records. */
export interface DeviceTable {
  a: number;
  b: number;
  [key: string]: unknown;
}

/** GPOS value record (placement / advance deltas). */
export interface PositionValue {
  xAdvance?: number | null;
  yAdvance?: number | null;
  xPlacement?: number | null;
  yPlacement?: number | null;
  xPlaDevice?: DeviceTable | null;
  yPlaDevice?: DeviceTable | null;
  xAdvDevice?: DeviceTable | null;
  yAdvDevice?: DeviceTable | null;
  [key: string]: unknown;
}

/** GPOS anchor point. */
export interface AnchorPoint {
  xCoordinate: number;
  yCoordinate: number;
  xDeviceTable?: DeviceTable | null;
  yDeviceTable?: DeviceTable | null;
  [key: string]: unknown;
}

/** Mark array record (GPOS types 4–6). */
export interface MarkRecord {
  class: number;
  markAnchor: AnchorPoint | null;
}

/** Lookup flag bitfield surface. */
export interface LookupFlags {
  ignoreBaseGlyphs?: boolean;
  ignoreLigatures?: boolean;
  ignoreMarks?: boolean;
  useMarkFilteringSet?: boolean;
  rightToLeft?: boolean;
  [key: string]: boolean | undefined;
}

/** GlyphIterator / lookup options. */
export interface GlyphIteratorOptions {
  flags?: LookupFlags;
  markAttachmentType?: number;
  [key: string]: unknown;
}

/** Decoded OpenType lookup. */
export interface OTLookup {
  lookupType: number;
  flags: GlyphIteratorOptions & { flags?: LookupFlags };
  markFilteringSet?: number;
  subTables: StructValue[];
  [key: string]: unknown;
}

/** Feature table. */
export interface OTFeature {
  featureParams?: unknown;
  lookupListIndexes: number[];
  [key: string]: unknown;
}

export interface OTFeatureRecord {
  tag: string;
  feature: OTFeature;
}

export interface OTLangSys {
  featureIndexes: number[];
  reqFeatureIndex?: number;
  [key: string]: unknown;
}

export interface OTLangSysRecord {
  tag: string;
  langSys: OTLangSys;
}

export interface OTScript {
  defaultLangSys: OTLangSys | null;
  langSysRecords: OTLangSysRecord[];
  [key: string]: unknown;
}

export interface OTScriptRecord {
  tag: string;
  script: OTScript;
}

export interface OTLookupList {
  get(index: number): OTLookup;
  length?: number;
}

/** FeatureVariations condition. */
export interface FeatureVariationCondition {
  axisIndex: number;
  filterRangeMinValue: number;
  filterRangeMaxValue: number;
}

export interface FeatureVariationRecord {
  conditionSet: { conditionTable: FeatureVariationCondition[] };
  featureTableSubstitution: {
    substitutions: Array<{ featureIndex: number; alternateFeatureTable: OTFeature }>;
  };
}

export interface FeatureVariationsTable {
  featureVariationRecords: FeatureVariationRecord[];
}

/** Shared GSUB/GPOS table header surface. */
export interface OTLayoutTable {
  scriptList: OTScriptRecord[] | null;
  featureList: OTFeatureRecord[];
  lookupList: OTLookupList;
  featureVariations?: FeatureVariationsTable | null;
  [key: string]: unknown;
}

/** GDEF table surface used by GlyphInfo / GPOS. */
export interface GDEFTable {
  glyphClassDef?: ClassDefTable | null;
  markAttachClassDef?: ClassDefTable | null;
  markGlyphSetsDef?: {
    coverage?: Array<CoverageTable | null | undefined>;
  } | null;
  itemVariationStore?: ItemVariationStore;
  [key: string]: unknown;
}

/** Context / chaining lookup record. */
export interface LookupRecord {
  sequenceIndex: number;
  lookupListIndex: number;
}

export interface ContextRule {
  input: number[];
  lookupRecords: LookupRecord[];
  classes?: number[];
}

export interface ContextSubtable {
  version: number;
  coverage: CoverageTable;
  ruleSets?: Array<ContextRule[] | null | undefined>;
  classDef?: ClassDefTable;
  classSet?: Array<ContextRule[] | null | undefined>;
  coverages?: CoverageTable[];
  lookupRecords?: LookupRecord[];
  [key: string]: unknown;
}

export interface ChainContextRule {
  backtrack: number[];
  input: number[];
  lookahead: number[];
  lookupRecords: LookupRecord[];
  classes?: number[];
}

export interface ChainContextSubtable {
  version: number;
  coverage: CoverageTable;
  chainRuleSets?: Array<ChainContextRule[] | null | undefined>;
  inputClassDef?: ClassDefTable | null;
  /** May be NULL (offset 0) when backtrack is unused. */
  backtrackClassDef?: ClassDefTable | null;
  /** May be NULL (offset 0) when lookahead is unused. */
  lookaheadClassDef?: ClassDefTable | null;
  chainClassSet?: Array<ChainContextRule[] | null | undefined>;
  backtrackGlyphCount?: number;
  backtrackCoverage?: CoverageTable[];
  inputGlyphCount?: number;
  inputCoverage?: CoverageTable[];
  lookaheadCoverage?: CoverageTable[];
  lookupRecords?: LookupRecord[];
  [key: string]: unknown;
}

/** Extension subtable wrapper (GSUB/GPOS type 7/9). */
export interface ExtensionSubtable {
  lookupType: number;
  extension: StructValue;
  [key: string]: unknown;
}

/** Planned lookup application entry. */
export interface FeatureLookup {
  feature: string;
  index: number;
  lookup: OTLookup;
}

/** GlyphInfo-like surface used while shaping. */
export interface GlyphInfoLike {
  id: number;
  codePoints: number[];
  features: FeatureMap;
  isMark: boolean;
  isBase: boolean;
  isLigature: boolean;
  markAttachmentType: number;
  ligatureID: number | null;
  ligatureComponent: number | null;
  isLigated: boolean;
  cursiveAttachment: number | null;
  markAttachment: number | null;
  shaperInfo: IndicShaperInfo | USEShaperInfo | null;
  substituted: boolean;
  isMultiplied: boolean;
  /** Owning font (GlyphInfo); used by Indic wouldSubstitute probes. */
  _font: LayoutFont;
  copy(): GlyphInfoLike;
}

/** Glyph position surface (matches GlyphPosition). */
export interface GlyphPositionLike {
  xAdvance: number;
  yAdvance: number;
  xOffset: number;
  yOffset: number;
}

/** GlyphRun surface used by layout engines. */
export interface GlyphRunLike {
  glyphs: Array<LayoutGlyph | GlyphInfoLike>;
  positions: GlyphPositionLike[] | null;
  features: FeatureMap;
  script: ScriptTag | string[] | null | undefined;
  language: LanguageTag | null;
  direction: TextDirection;
}

/** Optional advanced layout backend (AAT or OpenType). */
export interface AdvancedLayoutEngine {
  fallbackPosition?: boolean;
  setup?(glyphRun: GlyphRunLike): void;
  cleanup?(): void;
  substitute?(glyphRun: GlyphRunLike): void;
  /** GPOS returns applied feature records; truthiness / `.kern` checked by LayoutEngine. */
  position?(glyphRun: GlyphRunLike): FeatureMap | Record<string, OTFeature> | null | undefined | false;
  getAvailableFeatures(script?: ScriptTag | string[] | null, language?: LanguageTag | null): string[];
  stringsForGlyph?(gid: number): Iterable<string>;
  /** Present on OpenType layout engines (not AAT). */
  GSUBProcessor?: GSUBProcessorLike;
  GPOSProcessor?: unknown;
}

/** Indic script config (from indic-data INDIC_CONFIGS). */
export interface IndicConfig {
  hasOldSpec: boolean;
  virama: number;
  basePos: string;
  rephPos: number;
  rephMode: string;
  blwfMode: string;
}

/**
 * ShapingPlan surface used by shapers (extra fields set by Indic/Thai).
 * Mirrors `src/opentype/ShapingPlan.js` plus shaper-owned properties.
 */
export interface ShapingPlanLike {
  font: LayoutFont;
  script: ScriptTag | string[] | null | undefined;
  direction: TextDirection;
  stages: ShapingStage[];
  globalFeatures: FeatureMap;
  allFeatures: Record<string, number>;
  userFeatures: FeatureMap | null;
  bufferScript?: ScriptTag | string[] | null | undefined;
  /** Unicode script name from Script.fromOpenType (Indic). */
  unicodeScript?: string;
  /** Indic shaping config selected for the script. */
  indicConfig?: IndicConfig;
  /** True when shaping an old-spec Indic script tag (no trailing '2'). */
  isOldSpec?: boolean;
  add(arg: string | string[] | { global?: string[]; local?: string[] }, global?: boolean): void;
  addStage(
    arg: string | string[] | { global?: string[]; local?: string[] } | ShapingStageFn,
    global?: boolean
  ): void;
  setFeatureOverrides(features: FeatureInput | null | undefined): void;
  assignGlobalFeatures(glyphs: GlyphInfoLike[]): void;
}

/** Shaper stage callback. */
export type ShapingStageFn = (
  font: LayoutFont,
  glyphs: GlyphInfoLike[],
  plan: ShapingPlanLike
) => void;

export type ShapingStage = string[] | ShapingStageFn;

/** Shaper class surface (DefaultShaper and friends). */
export interface ShaperLike {
  zeroMarkWidths?: string;
  plan(
    plan: ShapingPlanLike,
    glyphs: GlyphInfoLike[],
    features: FeatureInput | null | undefined
  ): void;
  planFeatures?(plan: ShapingPlanLike): void;
  planPreprocessing?(plan: ShapingPlanLike): void;
  planPostprocessing?(plan: ShapingPlanLike, userFeatures: FeatureInput | null | undefined): void;
  assignFeatures?(plan: ShapingPlanLike, glyphs: GlyphInfoLike[]): void;
}

/** Host layout engine attached to a font (`font._layoutEngine`). */
export interface GSUBProcessorLike {
  features: Record<string, OTFeature | unknown>;
  applyFeatures(features: string[], glyphs: GlyphInfoLike[], positions?: GlyphPositionLike[] | null): void;
}

export interface LayoutEngineBackend {
  GSUBProcessor: GSUBProcessorLike;
  GPOSProcessor?: unknown;
}

export interface LayoutEngineHost {
  engine?: AdvancedLayoutEngine | null;
  layout?(
    string: string,
    userFeatures?: FeatureInput | null,
    script?: ScriptTag | string[] | null,
    language?: LanguageTag | null,
    direction?: TextDirection
  ): unknown;
  stringsForGlyph?(gid: number): Iterable<string>;
  getAvailableFeatures?(script?: ScriptTag | string[] | null, language?: LanguageTag | null): string[];
}

/** AAT UnboundedArray accessor (`src/tables/aat.js`). */
export interface AATUnboundedArray<T = unknown> {
  getItem(index: number): T;
  base?: number;
}

/** AAT lookup table binary-search header. */
export interface AATBinarySearchHeader {
  unitSize: number;
  nUnits: number;
  searchRange: number;
  entrySelector: number;
  rangeShift: number;
}

export interface AATLookupSegmentSingle<T = number> {
  lastGlyph: number;
  firstGlyph: number;
  value: T;
  glyph: number;
  values: T[];
}

/** Decoded AAT lookup table (versioned; unused fields may be absent at runtime). */
export interface AATLookupTableData {
  version: number;
  values: AATUnboundedArray<number> | number[];
  binarySearchHeader: AATBinarySearchHeader;
  segments: AATLookupSegmentSingle[];
  firstGlyph: number;
  count?: number;
}

/** AAT state-table entry (flags + optional contextual/ligature/insertion fields). */
export interface AATStateEntry {
  newState: number;
  flags: number;
  markIndex?: number;
  currentIndex?: number;
  action?: number;
  currentInsertIndex?: number;
  markedInsertIndex?: number;
}

export interface AATStateTable {
  nClasses: number;
  classTable: AATLookupTableData;
  stateArray: AATUnboundedArray<number[]>;
  entryTable: AATUnboundedArray<AATStateEntry>;
}

export interface MorxFeatureEntry {
  featureType: number;
  featureSetting: number;
  enableFlags: number;
  disableFlags: number;
}

export interface MorxSubtableTable {
  stateTable: AATStateTable;
  substitutionTable: { items: AATUnboundedArray<AATLookupTableData> };
  ligatureActions: AATUnboundedArray<number>;
  components: AATUnboundedArray<number>;
  ligatureList: AATUnboundedArray<number>;
  lookupTable: AATLookupTableData;
  insertionActions: AATUnboundedArray<number>;
  type?: number;
  [key: string]: unknown;
}

export interface MorxSubtable {
  length: number;
  coverage: number;
  type: number;
  subFeatureFlags: number;
  table: MorxSubtableTable;
}

export interface MorxChain {
  defaultFlags: number;
  chainLength: number;
  nFeatureEntries: number;
  nSubtables: number;
  features: MorxFeatureEntry[];
  subtables: MorxSubtable[];
}

export interface MorxTable {
  version: number;
  nChains: number;
  chains: MorxChain[];
}

/** AAT feature enable map: featureType → featureSetting → value. */
export type AATFeatureSettings = Record<number, Record<number, FeatureValue>>;

/** USE / Indic syllable info stored on GlyphInfo.shaperInfo. */
export interface USEShaperInfo {
  category: string;
  syllableType: string;
  syllable: number;
}

export interface IndicShaperInfo {
  category: number;
  position: number;
  syllableType: string;
  syllable: number;
}

/**
 * GlyphInfo after Indic `setupSyllables` — `shaperInfo` is always present
 * and uses numeric category/position flags.
 */
export type IndicGlyphInfo = Omit<GlyphInfoLike, 'shaperInfo'> & {
  shaperInfo: IndicShaperInfo;
};

/**
 * GlyphInfo after USE `setupSyllables` — `shaperInfo` is always present
 * and uses string categories.
 */
export type USEGlyphInfo = Omit<GlyphInfoLike, 'shaperInfo'> & {
  shaperInfo: USEShaperInfo;
};

/**
 * Shared shaperInfo bag. Indic uses numeric category/position flags;
 * USE uses string categories. Both shapes are written onto GlyphInfo.
 */
export interface GlyphShaperInfo {
  category: number | string;
  position?: number;
  syllableType: string;
  syllable: number;
  [key: string]: unknown;
}

/** Mark filtering set used by GlyphIterator. */
export interface MarkFilteringSet {
  has(id: number): boolean;
}

/** Kern pair (format 0). */
export interface KernPair {
  left: number;
  right: number;
  value: number;
}

export interface KernClassTable {
  firstGlyph: number;
  nGlyphs: number;
  offsets: number[];
}

export interface KernFormat0 {
  pairs: KernPair[];
}

export interface KernFormat2 {
  leftTable: KernClassTable;
  rightTable: KernClassTable;
  array: {
    off: number;
    values: LazyList<number>;
  };
}

export interface KernFormat3 {
  glyphCount: number;
  kernValue: number[];
  kernIndex: number[];
  leftClass: number[];
  rightClass: number[];
  rightClassCount: number;
}

export type KernSubtable = KernFormat0 | KernFormat2 | KernFormat3 | StructValue;

export interface KernCoverage {
  horizontal?: boolean;
  minimum?: boolean;
  crossStream?: boolean;
  override?: boolean;
  variation?: boolean;
  vertical?: boolean;
}

export interface KernSubtableEntry {
  version: number;
  format: number;
  coverage: KernCoverage;
  subtable: KernSubtable;
}

export interface KernTable {
  tables: KernSubtableEntry[];
  [key: string]: unknown;
}

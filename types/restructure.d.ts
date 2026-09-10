/**
 * Ambient typings for the `restructure` binary codec library.
 * Uses `unknown` (never `any`) for opaque parent/context values.
 */

declare module 'restructure' {
  /** Font/binary payloads; includes Node Buffer (Uint8Array subclass). */
  export type BinaryBuffer = ArrayBufferView;

  export type LengthSpec =
    | number
    | string
    | NumberT
    | ((this: StructValue, parent: StructValue) => number);

  /**
   * A restructure field may be a full codec, a partial codec, or a computed value function.
   */
  export type FieldSpec =
    | BaseType
    | ((this: StructValue, parent: StructValue) => unknown);

  export type StructFields = Record<string, FieldSpec>;

  /** Decoded struct instance with restructure metadata. */
  export interface StructValue {
    parent?: StructValue;
    _startOffset?: number;
    _currentOffset?: number;
    _length?: number;
    version?: number | string;
    [key: string]: unknown;
  }

  export interface PointerOptions {
    type?: 'local' | 'immediate' | 'parent' | 'global';
    allowNull?: boolean;
    nullValue?: number;
    lazy?: boolean;
    relativeTo?: (ctx: StructValue) => number;
  }

  export class DecodeStream {
    buffer: BinaryBuffer;
    view: DataView;
    pos: number;
    length: number;

    constructor(buffer: BinaryBuffer | Uint8Array);

    readString(length: number, encoding?: string): string | BinaryBuffer;
    readBuffer(length: number): BinaryBuffer;

    readUInt8(): number;
    readUInt16BE(): number;
    readUInt16LE(): number;
    readUInt24BE(): number;
    readUInt24LE(): number;
    readUInt32BE(): number;
    readUInt32LE(): number;
    readInt8(): number;
    readInt16BE(): number;
    readInt16LE(): number;
    readInt24BE(): number;
    readInt24LE(): number;
    readInt32BE(): number;
    readInt32LE(): number;
    readFloatBE(): number;
    readFloatLE(): number;
    readDoubleBE(): number;
    readDoubleLE(): number;

    static TYPES: Record<string, number>;
  }

  export class EncodeStream {
    buffer: BinaryBuffer;
    view: DataView;
    pos: number;
    length: number;

    constructor(buffer?: BinaryBuffer | number);

    writeBuffer(buffer: BinaryBuffer): void;
    writeString(string: string, encoding?: string): void;

    writeUInt8(value: number): void;
    writeUInt16BE(value: number): void;
    writeUInt16LE(value: number): void;
    writeUInt24BE(value: number): void;
    writeUInt24LE(value: number): void;
    writeUInt32BE(value: number): void;
    writeUInt32LE(value: number): void;
    writeInt8(value: number): void;
    writeInt16BE(value: number): void;
    writeInt16LE(value: number): void;
    writeInt24BE(value: number): void;
    writeInt24LE(value: number): void;
    writeInt32BE(value: number): void;
    writeInt32LE(value: number): void;
    writeFloatBE(value: number): void;
    writeFloatLE(value: number): void;
    writeDoubleBE(value: number): void;
    writeDoubleLE(value: number): void;

    /** Fill `length` bytes with `val` starting at the current position. */
    fill(val: number, length: number): void;
  }

  /**
   * Structural type for restructure codecs.
   * Custom table helpers often only implement a subset of methods.
   * CFF codecs may pass operands as an extra decode/encode argument, and
   * size-computation passes a null stream to encode().
   */
  export interface BaseType {
    decode?(
      stream: DecodeStream,
      parent?: StructValue | null,
      lengthOrOperands?: number | unknown[]
    ): unknown;
    encode?(
      stream: EncodeStream | null,
      value?: unknown,
      parent?: StructValue | null
    ): unknown;
    size?(value?: unknown, parent?: StructValue | null, includePointers?: boolean): number | unknown;
    fromBuffer?(buffer: BinaryBuffer): unknown;
    toBuffer?(value: unknown): BinaryBuffer;
    process?: (this: StructValue, stream: DecodeStream) => void;
    preEncode?: (this: StructValue, stream?: EncodeStream) => void;
  }

  export class NumberT implements BaseType {
    type: string;
    endian: string;
    fn: string;
    constructor(type: string, endian?: string);
    decode(stream: DecodeStream, parent?: StructValue | null, length?: number): number;
    encode(stream: EncodeStream, value?: number, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): number;
    toBuffer(value: number): BinaryBuffer;
  }

  export class Fixed extends NumberT {
    constructor(size: number, endian: string, fracBits?: number);
  }

  export class Struct implements BaseType {
    fields: StructFields;
    process?: (this: StructValue, stream: DecodeStream) => void;
    preEncode?: (this: StructValue, stream?: EncodeStream) => void;
    constructor(fields?: StructFields);
    decode(stream: DecodeStream, parent?: StructValue | null, length?: number): StructValue;
    encode(stream: EncodeStream, value?: StructValue, parent?: StructValue | null): void;
    size(value?: StructValue | null, parent?: StructValue | null, includePointers?: boolean): number;
    fromBuffer(buffer: BinaryBuffer): StructValue;
    toBuffer(value: StructValue): BinaryBuffer;
  }

  export class VersionedStruct extends Struct {
    type: BaseType | string;
    versions: Record<string | number, StructFields | VersionedStruct>;
    constructor(type: BaseType | string, versions?: Record<string | number, StructFields | VersionedStruct>);
  }

  export class ArrayT implements BaseType {
    type: BaseType;
    length: LengthSpec | null | undefined;
    lengthType: 'count' | 'bytes';
    constructor(type: BaseType, length?: LengthSpec | null, lengthType?: 'count' | 'bytes');
    decode(stream: DecodeStream, parent?: StructValue | null): unknown[];
    encode(stream: EncodeStream, value?: unknown[], parent?: StructValue | null): void;
    size(value?: unknown[], parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): unknown[];
    toBuffer(value: unknown[]): BinaryBuffer;
  }

  /** Decoded lazy array instance (get/toArray live on the value, not the codec). */
  export interface LazyArrayValue<T = unknown> {
    length: number;
    get(index: number): T | undefined;
    toArray(): T[];
  }

  export class LazyArray extends ArrayT {
    decode(stream: DecodeStream, parent?: StructValue | null): LazyArrayValue;
    encode(stream: EncodeStream, value?: unknown[] | LazyArrayValue, parent?: StructValue | null): void;
    size(value?: unknown[] | LazyArrayValue, parent?: StructValue | null): number;
  }

  export class Pointer implements BaseType {
    /** May be filled in lazily (e.g. CFFPointer sets a stub at decode/encode time). */
    offsetType: BaseType | null;
    type: BaseType | null;
    options: PointerOptions;
    constructor(
      offsetType: BaseType | null,
      type: BaseType | 'void' | null,
      options?: PointerOptions
    );
    decode(
      stream: DecodeStream,
      parent?: StructValue | null,
      lengthOrOperands?: number | unknown[]
    ): unknown;
    encode(
      stream: EncodeStream | null,
      value?: unknown,
      parent?: StructValue | null
    ): unknown;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): unknown;
    toBuffer(value: unknown): BinaryBuffer;
  }

  /**
   * Deferred pointer payload whose codec type is chosen at encode/size time
   * (used by SFNT directory table entries).
   */
  export class VoidPointer {
    type: BaseType;
    value: unknown;
    constructor(type: BaseType, value: unknown);
  }

  export class StringT implements BaseType {
    constructor(length?: LengthSpec | null, encoding?: string | ((this: StructValue, parent: StructValue) => string));
    decode(stream: DecodeStream, parent?: StructValue | null): string;
    encode(stream: EncodeStream, value?: string, parent?: StructValue | null): void;
    size(value?: string, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): string;
    toBuffer(value: string): BinaryBuffer;
  }

  export class BufferT implements BaseType {
    constructor(length?: LengthSpec | null);
    decode(stream: DecodeStream, parent?: StructValue | null): BinaryBuffer;
    encode(stream: EncodeStream, value?: BinaryBuffer, parent?: StructValue | null): void;
    size(value?: BinaryBuffer, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): BinaryBuffer;
    toBuffer(value: BinaryBuffer): BinaryBuffer;
  }

  export class Optional implements BaseType {
    type: BaseType;
    condition: boolean | ((this: StructValue, parent: StructValue) => boolean);
    constructor(type: BaseType, condition?: boolean | ((this: StructValue, parent: StructValue) => boolean));
    decode(stream: DecodeStream, parent?: StructValue | null): unknown;
    encode(stream: EncodeStream, value?: unknown, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): unknown;
    toBuffer(value: unknown): BinaryBuffer;
  }

  export class Reserved implements BaseType {
    constructor(type?: BaseType, length?: LengthSpec);
    decode(stream: DecodeStream, parent?: StructValue | null): undefined;
    encode(stream: EncodeStream, value?: unknown, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): undefined;
    toBuffer(value: unknown): BinaryBuffer;
  }

  export class Enum implements BaseType {
    constructor(type: BaseType, options?: string[] | Record<number, string>);
    decode(stream: DecodeStream, parent?: StructValue | null): string | number;
    encode(stream: EncodeStream, value?: string | number, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): string | number;
    toBuffer(value: string | number): BinaryBuffer;
  }

  export class Bitfield implements BaseType {
    constructor(type: BaseType, flags?: Array<string | null>);
    decode(stream: DecodeStream, parent?: StructValue | null): Record<string, boolean>;
    encode(stream: EncodeStream, value?: Record<string, boolean>, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): Record<string, boolean>;
    toBuffer(value: Record<string, boolean>): BinaryBuffer;
  }

  export class BooleanT implements BaseType {
    constructor(type?: BaseType);
    decode(stream: DecodeStream, parent?: StructValue | null): boolean;
    encode(stream: EncodeStream, value?: boolean, parent?: StructValue | null): void;
    size(value?: unknown, parent?: StructValue | null): number;
    fromBuffer(buffer: BinaryBuffer): boolean;
    toBuffer(value: boolean): BinaryBuffer;
  }

  export class PropertyDescriptor {
    enumerable: boolean;
    configurable: boolean;
    get?: () => unknown;
    set?: (value: unknown) => void;
    value?: unknown;
    writable?: boolean;
    constructor(opts?: {
      enumerable?: boolean;
      configurable?: boolean;
      writable?: boolean;
      value?: unknown;
      get?: () => unknown;
      set?: (value: unknown) => void;
    });
  }

  export function resolveLength(
    length: LengthSpec,
    stream?: DecodeStream | null,
    parent?: StructValue | null
  ): number;

  export { ArrayT as Array };
  export { StringT as String };
  export { BufferT as Buffer };
  export { BooleanT as Boolean };
  export { NumberT as Number };

  export const uint8: NumberT;
  export const uint16: NumberT;
  export const uint16be: NumberT;
  export const uint16le: NumberT;
  export const uint24: NumberT;
  export const uint24be: NumberT;
  export const uint24le: NumberT;
  export const uint32: NumberT;
  export const uint32be: NumberT;
  export const uint32le: NumberT;
  export const int8: NumberT;
  export const int16: NumberT;
  export const int16be: NumberT;
  export const int16le: NumberT;
  export const int24: NumberT;
  export const int24be: NumberT;
  export const int24le: NumberT;
  export const int32: NumberT;
  export const int32be: NumberT;
  export const int32le: NumberT;
  export const float: NumberT;
  export const floatbe: NumberT;
  export const floatle: NumberT;
  export const double: NumberT;
  export const doublebe: NumberT;
  export const doublele: NumberT;
  export const fixed16: Fixed;
  export const fixed16be: Fixed;
  export const fixed16le: Fixed;
  export const fixed32: Fixed;
  export const fixed32be: Fixed;
  export const fixed32le: Fixed;
}

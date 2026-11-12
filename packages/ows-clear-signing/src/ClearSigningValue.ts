import {
  bytesToHex,
  getAddress,
  hexToBytes,
  isHex,
  numberToBytes,
  stringToBytes,
  type AbiParameter,
} from "viem";
import { ClearSigningCanonicalString, EVMAccountAddress } from "@1shotapi/ows-types";
import { ClearSigningError } from "./ClearSigningError.js";
import type { IClearSigningTypedDataField } from "./interfaces.js";

export enum EClearSigningValueKind {
  /** Decoded primitive: bigint (int/uint), string (address/bytes/string), boolean. */
  Leaf = "leaf",
  Array = "array",
  Struct = "struct",
  /** Literal from the descriptor (`value`, `$.` references, constant params). */
  Constant = "constant",
}

const ARRAY_SUFFIX = /\[(\d*)\]$/;

/**
 * Decoded structured data with its Solidity / EIP-712 type kept alongside, so path slices
 * and formatters know how to interpret each value (e.g. a slice of a `uint256` vs `bytes`).
 */
export class ClearSigningValue {
  constructor(
    public readonly kind: EClearSigningValueKind,
    /** Solidity type for leaves (`uint256`, `address`, `bytes`, …); struct/array type otherwise. */
    public readonly type: string,
    public readonly value: unknown,
  ) {}

  static constant(value: unknown): ClearSigningValue {
    return new ClearSigningValue(EClearSigningValueKind.Constant, "", value);
  }

  static leaf(type: string, value: unknown): ClearSigningValue {
    return new ClearSigningValue(
      EClearSigningValueKind.Leaf,
      type,
      ClearSigningValue.normalizeLeaf(type, value),
    );
  }

  static struct(
    type: string,
    members: Record<string, ClearSigningValue>,
  ): ClearSigningValue {
    return new ClearSigningValue(EClearSigningValueKind.Struct, type, members);
  }

  /** Build the `#` root from viem `decodeFunctionData` args and the function inputs. */
  static fromAbiArguments(
    inputs: readonly AbiParameter[],
    args: readonly unknown[],
  ): ClearSigningValue {
    const members: Record<string, ClearSigningValue> = {};
    inputs.forEach((input, i) => {
      members[input.name || String(i)] = ClearSigningValue.fromAbi(input, args[i]);
    });
    return ClearSigningValue.struct("", members);
  }

  /** Build the `#` root from an EIP-712 message. */
  static fromTypedData(
    types: Record<string, ReadonlyArray<IClearSigningTypedDataField>>,
    primaryType: string,
    message: Record<string, unknown>,
  ): ClearSigningValue {
    return ClearSigningValue.fromEip712(types, primaryType, message);
  }

  private static fromAbi(param: AbiParameter, raw: unknown): ClearSigningValue {
    const arrayMatch = ARRAY_SUFFIX.exec(param.type);
    if (arrayMatch) {
      if (!Array.isArray(raw)) {
        throw new ClearSigningError(`Expected array for ${param.type}`);
      }
      const element = {
        ...param,
        type: param.type.slice(0, arrayMatch.index),
      } as AbiParameter;
      return new ClearSigningValue(
        EClearSigningValueKind.Array,
        param.type,
        raw.map((item) => ClearSigningValue.fromAbi(element, item)),
      );
    }
    if (param.type === "tuple") {
      const components =
        "components" in param ? (param.components as readonly AbiParameter[]) : [];
      const source = raw as Record<string, unknown> & unknown[];
      const members: Record<string, ClearSigningValue> = {};
      components.forEach((component, i) => {
        const name = component.name || String(i);
        const item =
          component.name && source[component.name] !== undefined
            ? source[component.name]
            : source[i];
        members[name] = ClearSigningValue.fromAbi(component, item);
      });
      return ClearSigningValue.struct("tuple", members);
    }
    return ClearSigningValue.leaf(param.type, raw);
  }

  private static fromEip712(
    types: Record<string, ReadonlyArray<IClearSigningTypedDataField>>,
    type: string,
    raw: unknown,
  ): ClearSigningValue {
    const arrayMatch = ARRAY_SUFFIX.exec(type);
    if (arrayMatch) {
      if (!Array.isArray(raw)) {
        throw new ClearSigningError(`Expected array for ${type}`);
      }
      const elementType = type.slice(0, arrayMatch.index);
      return new ClearSigningValue(
        EClearSigningValueKind.Array,
        type,
        raw.map((item) => ClearSigningValue.fromEip712(types, elementType, item)),
      );
    }
    const structFields = types[type];
    if (structFields) {
      if (raw === null || typeof raw !== "object") {
        throw new ClearSigningError(`Expected struct for ${type}`);
      }
      const source = raw as Record<string, unknown>;
      const members: Record<string, ClearSigningValue> = {};
      for (const field of structFields) {
        members[field.name] = ClearSigningValue.fromEip712(
          types,
          field.type,
          source[field.name],
        );
      }
      return ClearSigningValue.struct(type, members);
    }
    return ClearSigningValue.leaf(type, raw);
  }

  private static normalizeLeaf(type: string, value: unknown): unknown {
    if (/^u?int\d*$/.test(type)) {
      if (
        typeof value === "bigint" ||
        typeof value === "number" ||
        (typeof value === "string" && value.trim() !== "")
      ) {
        try {
          return BigInt(value);
        } catch {
          // fall through
        }
      }
      throw new ClearSigningError(`Invalid ${type} value`);
    }
    if (type === "address") {
      if (typeof value !== "string" || !/^0x[0-9a-fA-F]{40}$/.test(value)) {
        throw new ClearSigningError("Invalid address value");
      }
      return getAddress(value);
    }
    if (type === "bool") return Boolean(value);
    if (type === "string") return String(value ?? "");
    if (type.startsWith("bytes")) {
      if (typeof value !== "string" || !isHex(value)) {
        throw new ClearSigningError(`Invalid ${type} value`);
      }
      return value.toLowerCase();
    }
    return value;
  }

  get isInteger(): boolean {
    return this.kind === EClearSigningValueKind.Leaf && typeof this.value === "bigint";
  }

  /** Bytes view of a leaf, used by path slices. */
  toBytes(): Uint8Array {
    if (this.kind === EClearSigningValueKind.Leaf) {
      if (typeof this.value === "bigint") {
        const v = this.value < 0n ? (1n << 256n) + this.value : this.value;
        return numberToBytes(v, { size: 32 });
      }
      if (typeof this.value === "boolean") return new Uint8Array([this.value ? 1 : 0]);
      if (this.type === "string") return stringToBytes(this.value as string);
      if (typeof this.value === "string" && isHex(this.value)) {
        return hexToBytes(this.value as `0x${string}`);
      }
    }
    if (this.kind === EClearSigningValueKind.Constant && typeof this.value === "string") {
      if (isHex(this.value)) return hexToBytes(this.value as `0x${string}`);
      return stringToBytes(this.value);
    }
    throw new ClearSigningError("Value cannot be sliced");
  }

  /** Byte slice of a leaf → `bytes` leaf (spec: slices on primitives select bytes). */
  sliceBytes(start: number | undefined, end: number | undefined): ClearSigningValue {
    const bytes = this.toBytes();
    const sliced = bytes.slice(
      ClearSigningValue.sliceIndex(start, bytes.length, 0),
      ClearSigningValue.sliceIndex(end, bytes.length, bytes.length),
    );
    return ClearSigningValue.leaf("bytes", bytesToHex(sliced));
  }

  static sliceIndex(index: number | undefined, length: number, fallback: number): number {
    if (index === undefined) return fallback;
    const resolved = index < 0 ? length + index : index;
    return Math.max(0, Math.min(length, resolved));
  }

  /** Interpret as an unsigned/signed integer (ints, byte strings, numeric constants). */
  asBigInt(): bigint {
    const v = this.value;
    if (typeof v === "bigint") return v;
    if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
    if (typeof v === "string") {
      if (v === "0x" || v === "") return 0n;
      if (isHex(v) || /^-?[0-9]+$/.test(v)) return BigInt(v);
    }
    if (typeof v === "boolean") return v ? 1n : 0n;
    throw new ClearSigningError("Value is not numeric");
  }

  /** Interpret as an address (address leaves, ≥20-byte slices → last 20 bytes, uint → low 160 bits). */
  asAddress(): EVMAccountAddress {
    const v = this.value;
    if (typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v)) {
      return EVMAccountAddress(getAddress(v));
    }
    if (typeof v === "bigint") {
      const low = v & ((1n << 160n) - 1n);
      return EVMAccountAddress(getAddress(`0x${low.toString(16).padStart(40, "0")}`));
    }
    if (typeof v === "string" && isHex(v)) {
      const bytes = hexToBytes(v as `0x${string}`);
      if (bytes.length >= 20) {
        return EVMAccountAddress(getAddress(bytesToHex(bytes.slice(bytes.length - 20))));
      }
    }
    throw new ClearSigningError("Value is not an address");
  }

  /** Canonical rendering of a primitive (decimal ints, `true`/`false`, strings as-is, JSON otherwise). */
  static canonical(v: unknown): ClearSigningCanonicalString {
    if (typeof v === "bigint") return ClearSigningCanonicalString(v.toString());
    if (typeof v === "boolean") return ClearSigningCanonicalString(v ? "true" : "false");
    if (typeof v === "string") return ClearSigningCanonicalString(v);
    if (v === null || v === undefined) return ClearSigningCanonicalString("");
    return ClearSigningCanonicalString(JSON.stringify(v));
  }

  /** Canonical raw rendering (decimal ints, checksummed addresses, hex bytes, utf-8 strings). */
  toRawString(): ClearSigningCanonicalString {
    switch (this.kind) {
      case EClearSigningValueKind.Leaf:
      case EClearSigningValueKind.Constant:
        return ClearSigningValue.canonical(this.value);
      case EClearSigningValueKind.Array:
        return ClearSigningCanonicalString(
          `[${(this.value as ClearSigningValue[]).map((v) => v.toRawString()).join(", ")}]`,
        );
      case EClearSigningValueKind.Struct:
        return ClearSigningCanonicalString(
          `{${Object.entries(this.value as Record<string, ClearSigningValue>)
            .map(([k, v]) => `${k}: ${v.toRawString()}`)
            .join(", ")}}`,
        );
    }
  }
}

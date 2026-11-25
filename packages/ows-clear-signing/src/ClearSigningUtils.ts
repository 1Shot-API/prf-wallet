import {
  keccak256,
  parseAbiItem,
  stringToHex,
  toFunctionSelector,
  type AbiFunction,
} from "viem";
import {
  ChainUtils,
  EIP712EncodeTypeHash,
  EIP712TypeNameSchema,
  EVMContractAddressSchema,
  EVMFunctionSelector,
  type EVMChainId,
  type EVMContractAddress,
  type HexString,
  type IClearSigningCalldataLookupKey,
  type IClearSigningEip712LookupKey,
} from "@1shotapi/ows-types";
import { ClearSigningError } from "./ClearSigningError.js";
import type {
  IClearSigningTypedData,
  IClearSigningTypedDataField,
} from "./interfaces.js";

const ARRAY_SUFFIXES = /(\[\d*\])+$/;

/** ERC-7730 matching helpers shared by wallets (lookup) and resolvers (format selection). */
export class ClearSigningUtils {
  /**
   * Registry lookup key for a contract call, or `null` when there is no selector
   * (plain native transfer / calldata shorter than 4 bytes).
   */
  static calldataLookupKey(
    chainId: EVMChainId,
    to: EVMContractAddress,
    data: HexString,
  ): IClearSigningCalldataLookupKey | null {
    if (!/^0x[0-9a-fA-F]{8}/.test(data)) return null;
    return {
      chainId,
      address: to,
      selector: EVMFunctionSelector(data.slice(0, 10).toLowerCase() as `0x${string}`),
    };
  }

  /**
   * Registry lookup key for an EIP-712 message, or `null` when the domain lacks
   * `chainId` / `verifyingContract` (ERC-7730 says wallets SHOULD NOT clear-sign those).
   */
  static eip712LookupKey(
    typedData: IClearSigningTypedData,
  ): IClearSigningEip712LookupKey | null {
    const { domain, primaryType, types } = typedData;
    if (primaryType === "EIP712Domain" || !types[primaryType]) return null;
    const name = EIP712TypeNameSchema.safeParse(primaryType);
    const contract = EVMContractAddressSchema.safeParse(domain.verifyingContract);
    const chainId = ClearSigningUtils.domainChainId(domain);
    if (!name.success || !contract.success || chainId === null) return null;
    let encoded: string;
    try {
      encoded = ClearSigningUtils.encodeType(types, primaryType);
    } catch {
      return null;
    }
    return {
      chainId,
      verifyingContract: contract.data,
      primaryType: name.data,
      encodeTypeHash: ClearSigningUtils.hashEncodeType(encoded),
    };
  }

  /** `domain.chainId` as a branded chain id, or `null` when missing / invalid. */
  static domainChainId(domain: Record<string, unknown>): EVMChainId | null {
    const raw = domain.chainId;
    if (typeof raw !== "number" && typeof raw !== "string" && typeof raw !== "bigint") {
      return null;
    }
    try {
      return ChainUtils.asEVMChainId(raw);
    } catch {
      return null;
    }
  }

  /** EIP-712 `encodeType(primaryType)`: primary struct first, then referenced structs sorted by name. */
  static encodeType(
    types: Record<string, ReadonlyArray<IClearSigningTypedDataField>>,
    primaryType: string,
  ): string {
    const deps = new Set<string>();
    const visit = (typeName: string): void => {
      if (deps.has(typeName) || typeName === "EIP712Domain") return;
      const fields = types[typeName];
      if (!fields) return;
      deps.add(typeName);
      for (const field of fields) {
        visit(field.type.replace(ARRAY_SUFFIXES, ""));
      }
    };
    if (!types[primaryType]) {
      throw new ClearSigningError(`Unknown EIP-712 type ${primaryType}`);
    }
    visit(primaryType);
    deps.delete(primaryType);
    return [primaryType, ...[...deps].sort()]
      .map(
        (name) =>
          `${name}(${types[name].map((f) => `${f.type} ${f.name}`).join(",")})`,
      )
      .join("");
  }

  static hashEncodeType(encodeType: string): EIP712EncodeTypeHash {
    return EIP712EncodeTypeHash(keccak256(stringToHex(encodeType)));
  }

  /**
   * Canonicalize an EIP-712 `display.formats` key (registry keys are `encodeType` strings;
   * tolerate stray whitespace after commas / around parentheses).
   */
  static normalizeEncodeType(key: string): string {
    return key.replace(/\s*([(),])\s*/g, "$1").trim();
  }

  /** Parse a calldata `display.formats` key (function fragment with parameter names). */
  static parseFunctionKey(key: string): AbiFunction {
    try {
      const item = parseAbiItem(`function ${key.trim()}` as string);
      if (item.type !== "function") throw new Error("not a function");
      return item as AbiFunction;
    } catch {
      throw new ClearSigningError(`Invalid function fragment: ${key}`);
    }
  }

  /** Selector of a calldata `display.formats` key (parameter names ignored). */
  static selectorForFunctionKey(key: string): EVMFunctionSelector {
    return EVMFunctionSelector(
      toFunctionSelector(ClearSigningUtils.parseFunctionKey(key)).toLowerCase() as `0x${string}`,
    );
  }
}

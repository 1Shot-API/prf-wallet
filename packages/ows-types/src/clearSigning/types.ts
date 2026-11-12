import type { EClearSigningFieldFormat } from "../enums/EClearSigningFieldFormat.js";
import type { EClearSigningIteration } from "../enums/EClearSigningIteration.js";
import type { EClearSigningVisibility } from "../enums/EClearSigningVisibility.js";
import type { ClearSigningRegistrySha } from "../primitives/ClearSigningRegistrySha.js";
import type { EIP712EncodeTypeHash } from "../primitives/EIP712EncodeTypeHash.js";
import type { EIP712TypeName } from "../primitives/EIP712TypeName.js";
import type { EVMChainId } from "../primitives/EVMChainId.js";
import type { EVMContractAddress } from "../primitives/EVMContractAddress.js";
import type { EVMFunctionSelector } from "../primitives/EVMFunctionSelector.js";
import type { HexString } from "../primitives/HexString.js";

/**
 * ERC-7730 clear-signing types shared by the Relayer (resolver) and Branding Layer (renderer).
 *
 * The Relayer returns a *resolved* descriptor: `includes` merged, field-level `$ref`s to
 * `$.display.definitions` inlined, and `display.formats` trimmed to the single format that
 * matches the request. Everything else (context, metadata) is kept so the wallet can verify
 * binding constraints and resolve `$.metadata.*` references.
 */

/** Calldata registry lookup: `eip155:<chainId>:<to>` plus the calldata selector. */
export interface IClearSigningCalldataLookupKey {
  chainId: EVMChainId;
  address: EVMContractAddress;
  selector: EVMFunctionSelector;
}

/** EIP-712 registry lookup: domain chain + verifying contract + primary type + type hash. */
export interface IClearSigningEip712LookupKey {
  chainId: EVMChainId;
  verifyingContract: EVMContractAddress;
  primaryType: EIP712TypeName;
  encodeTypeHash: EIP712EncodeTypeHash;
}

/** A `{ chainId, address }` deployment option from `context.contract` / `context.eip712`. */
export interface IClearSigningDeployment {
  chainId: EVMChainId;
  address: EVMContractAddress;
}

/** `context.contract` binding (calldata descriptors). */
export interface IClearSigningContractContext {
  deployments: IClearSigningDeployment[];
}

/** `context.eip712` binding (EIP-712 descriptors). */
export interface IClearSigningEip712Context {
  domain?: Record<string, unknown>;
  deployments?: IClearSigningDeployment[];
  domainSeparator?: HexString;
}

/** Descriptor `context`: exactly one of `contract` / `eip712` is expected. */
export interface IClearSigningDescriptorContext {
  contract?: IClearSigningContractContext;
  eip712?: IClearSigningEip712Context;
}

/** `metadata.token` for ERC-20 contracts that do not expose name/symbol/decimals. */
export interface IClearSigningTokenInfo {
  name?: string;
  ticker?: string;
  decimals?: number;
}

/** `metadata.maps.<name>`: context-dependent constants keyed by a resolved path value. */
export interface IClearSigningMap {
  values: Record<string, unknown>;
}

/** Descriptor `metadata` section. */
export interface IClearSigningMetadata {
  owner?: string;
  contractName?: string;
  info?: { url?: string; deploymentDate?: string };
  token?: IClearSigningTokenInfo;
  constants?: Record<string, unknown>;
  maps?: Record<string, IClearSigningMap>;
  enums?: Record<string, Record<string, string>>;
}

/** Complex `visible` rule. */
export interface IClearSigningVisibilityRule {
  ifNotIn?: unknown[];
  mustMatch?: unknown[];
}

/** Field `encryption` hint. */
export interface IClearSigningEncryption {
  scheme: string;
  plaintextType?: string;
  fallbackLabel?: string;
}

/**
 * A field format specification, or a group (when `fields` is set).
 * `params` stays loosely typed: values may be constants, `$.` references, or map references,
 * and are validated by the renderer per format.
 */
export interface IClearSigningField {
  path?: string;
  value?: unknown;
  label?: string;
  format?: EClearSigningFieldFormat;
  params?: Record<string, unknown>;
  visible?: EClearSigningVisibility | IClearSigningVisibilityRule;
  separator?: string;
  encryption?: IClearSigningEncryption;
  fields?: IClearSigningField[];
  iteration?: EClearSigningIteration;
}

/** The single matched `display.formats` entry, with its key preserved. */
export interface IClearSigningFormat {
  /** Function fragment with parameter names (calldata) or `encodeType` string (EIP-712). */
  key: string;
  intent: string | Record<string, string>;
  interpolatedIntent?: string;
  fields: IClearSigningField[];
}

/** Resolved, single-format descriptor served by the Relayer. */
export interface IClearSigningDescriptor {
  context: IClearSigningDescriptorContext;
  metadata: IClearSigningMetadata;
  format: IClearSigningFormat;
}

/** Relayer hit. */
export interface IClearSigningLookupFound {
  found: true;
  registrySha: ClearSigningRegistrySha;
  /** Registry-relative path of the descriptor file (informational / provenance). */
  path: string;
  descriptor: IClearSigningDescriptor;
}

/** Relayer miss (no registry entry, no matching format, or descriptor rejected). */
export interface IClearSigningLookupNotFound {
  found: false;
}

export type ClearSigningLookupResult =
  | IClearSigningLookupFound
  | IClearSigningLookupNotFound;

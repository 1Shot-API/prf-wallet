import type { EVMAccountAddress, EVMChainId, HexString } from "../primitives/index.js";

/**
 * EIP-7715 base permission object (permission type + adjustment flag + type-specific data).
 * Concrete `type` / `data` shapes are defined by additional ERCs (e.g. erc20-token-periodic).
 */
export interface IExecutionPermission {
  type: string;
  isAdjustmentAllowed: boolean;
  data: Record<string, unknown>;
}

/** EIP-7715 rule constraining a permission (e.g. expiry). */
export interface IExecutionPermissionRule {
  type: string;
  data: Record<string, unknown>;
}

/**
 * One entry in `wallet_requestExecutionPermissions` params.
 * `params` is the array of these objects (not nested in a further wrapper).
 */
export interface IExecutionPermissionRequest {
  chainId: EVMChainId;
  /** Optional; wallet may choose the account when omitted. */
  from?: EVMAccountAddress;
  /** Session / delegatee account that receives the permission. */
  to: EVMAccountAddress;
  permission: IExecutionPermission;
  rules?: IExecutionPermissionRule[];
}

/** ERC-4337 factory dependency required before redeeming a permission. */
export interface IExecutionPermissionDependency {
  factory: EVMAccountAddress;
  factoryData: HexString;
}

/**
 * Grant response: request fields (possibly attenuated) plus redeem metadata.
 * `context` is opaque to the host and is passed to ERC-7710 redemption.
 */
export interface IExecutionPermissionResponse extends IExecutionPermissionRequest {
  context: HexString;
  dependencies: IExecutionPermissionDependency[];
  delegationManager: EVMAccountAddress;
}

/** Params object for `wallet_revokeExecutionPermission`. */
export interface IRevokeExecutionPermissionParams {
  permissionContext: HexString;
}

/** Per-permission-type support entry from `wallet_getSupportedExecutionPermissions`. */
export interface ISupportedExecutionPermissionEntry {
  chainIds: EVMChainId[];
  ruleTypes: string[];
}

/**
 * Map of permission type → supported chains and rule types.
 * Keys are permission type strings (e.g. `"erc20-token-periodic"`).
 */
export type SupportedExecutionPermissions = Record<
  string,
  ISupportedExecutionPermissionEntry
>;

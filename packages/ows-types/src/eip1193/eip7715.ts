import type {
  EVMAccountAddress,
  EVMChainId,
  EVMContractAddress,
  HexString,
} from "../primitives/index.js";

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
 * One appended caveat on an EIP-7715 permission request.
 *
 * The wire shape nests the caveat's config under `data` (consistent with
 * `IExecutionPermission.data`), rather than the spread form
 * `@metamask/smart-accounts-kit`'s `CoreCaveatConfiguration` uses internally
 * (`{ type, ...config }`). At sign time the wallet maps `data` to the kit's
 * caveat config via `builder.addCaveat(type, data)` and merges the result onto
 * the top-level scope through `createDelegation({ scope, caveats })`.
 *
 * `type` matches a `CaveatType` value from `@metamask/smart-accounts-kit`.
 * `data` carries the config for that caveat's builder (e.g.
 * `{ startIndex: 4, value: "0x..." }` for `allowedCalldata`).
 */
export interface IAppendedCaveatConfiguration {
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
  /**
   * Appended caveats merged onto the top-level `permission` scope at sign time,
   * mirroring `createDelegation({ scope, caveats })` in
   * `@metamask/smart-accounts-kit`. Optional + additive: omitting it keeps the
   * legacy single-scope behaviour.
   */
  caveats?: IAppendedCaveatConfiguration[];
}

/** ERC-4337 factory dependency required before redeeming a permission. */
export interface IExecutionPermissionDependency {
  factory: EVMContractAddress;
  factoryData: HexString;
}

/**
 * Grant response: request fields (possibly attenuated) plus redeem metadata.
 * `context` is opaque to the host and is passed to ERC-7710 redemption.
 */
export interface IExecutionPermissionResponse extends IExecutionPermissionRequest {
  context: HexString;
  dependencies: IExecutionPermissionDependency[];
  delegationManager: EVMContractAddress;
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

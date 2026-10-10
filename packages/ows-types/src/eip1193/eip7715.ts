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

/**
 * EIP-7715 rule constraining a permission (e.g. expiry, allowedTargets).
 *
 * Host-stacked enforcers on `wallet_requestExecutionPermissions` use optional
 * top-level `rules[]` with this shape. At sign time the wallet maps each entry
 * via `builder.addCaveat(type, data)` / `createDelegation({ scope, caveats })`
 * — MetaMask kit “caveats” are the on-delegation concept after that mapping.
 *
 * `type` matches a kit `CaveatType` (or a wallet-allowlisted custom enforcer such
 * as `chainlink-price-rule`). `data` carries the builder config for that type
 * (e.g. `{ targets: address[] }` for `allowedTargets`).
 */
export interface IExecutionPermissionRule {
  type: string;
  data: Record<string, unknown>;
}

/**
 * Alias for {@link IExecutionPermissionRule} used at wallet DF mapping call sites
 * that still speak “appended caveats” after host `rules` → `addCaveat`.
 */
export type IAppendedCaveatConfiguration = IExecutionPermissionRule;

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
  /**
   * Host-stacked enforcer configs (EIP-7715 `rules`), AND-ed onto the
   * top-level `permission` scope at sign time. Optional + additive: omitting
   * it keeps single-scope behaviour.
   */
  rules?: IExecutionPermissionRule[];
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

/**
 * EIP-2255 wallet permissions (`wallet_requestPermissions`,
 * `wallet_getPermissions`, `wallet_revokePermissions`).
 */

/** Permission name → (empty) caveat request object, e.g. `{ eth_accounts: {} }`. */
export interface IRequestedPermissions {
  [permission: string]: Record<string, unknown>;
}

export interface IWalletPermissionCaveat {
  type: string;
  value: unknown;
}

export interface IWalletPermission {
  parentCapability: string;
  invoker?: string;
  date?: number;
  caveats?: IWalletPermissionCaveat[];
}

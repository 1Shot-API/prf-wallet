/**
 * EIP-1193 wallet methods that Branding Layers typically implement
 * (accounts, chain, signing). JSON-RPC read methods live in
 * {@link EIP1193_READ_METHODS}.
 */
export const EIP1193_METHODS = [
  "eth_requestAccounts",
  "eth_accounts",
  "eth_chainId",
  "personal_sign",
  "eth_sign",
  "eth_signTypedData",
  "eth_signTypedData_v3",
  "eth_signTypedData_v4",
  "eth_sendTransaction",
  "eth_signTransaction",
  "wallet_switchEthereumChain",
  "wallet_addEthereumChain",
  "wallet_watchAsset",
  // EIP-7715 — Request Permissions from Wallets
  "wallet_requestExecutionPermissions",
  "wallet_revokeExecutionPermission",
  "wallet_getSupportedExecutionPermissions",
  "wallet_getGrantedExecutionPermissions",
] as const;

export type Eip1193Method = (typeof EIP1193_METHODS)[number];

export function isEip1193Method(method: string): method is Eip1193Method {
  return (EIP1193_METHODS as readonly string[]).includes(method);
}

/**
 * Non-signing EIP-1193 methods commonly proxied to a JSON-RPC HTTP endpoint.
 * Account / signing methods are intentionally omitted.
 */
export const EIP1193_READ_METHODS = [
  "eth_blockNumber",
  "eth_call",
  "eth_estimateGas",
  "eth_createAccessList",
  "eth_gasPrice",
  "eth_feeHistory",
  "eth_maxPriorityFeePerGas",
  "eth_getBalance",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getProof",
  "eth_getTransactionCount",
  "eth_getBlockByHash",
  "eth_getBlockByNumber",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "eth_getUncleByBlockHashAndIndex",
  "eth_getUncleByBlockNumberAndIndex",
  "eth_getUncleCountByBlockHash",
  "eth_getUncleCountByBlockNumber",
  "eth_getTransactionByHash",
  "eth_getTransactionByBlockHashAndIndex",
  "eth_getTransactionByBlockNumberAndIndex",
  "eth_getTransactionReceipt",
  "eth_getLogs",
  "eth_getFilterChanges",
  "eth_getFilterLogs",
  "eth_newFilter",
  "eth_newBlockFilter",
  "eth_newPendingTransactionFilter",
  "eth_uninstallFilter",
  "eth_syncing",
  "net_version",
  "net_listening",
  "net_peerCount",
  "web3_clientVersion",
  "web3_sha3",
] as const;

export type Eip1193ReadMethod = (typeof EIP1193_READ_METHODS)[number];

/** MetaMask / EIP-1193 code for an unknown `wallet_switchEthereumChain` target. */
export const EIP1193_UNRECOGNIZED_CHAIN_ID = 4902;

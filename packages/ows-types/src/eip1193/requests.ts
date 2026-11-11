import type {
  EVMAccountAddress,
  EVMChainId,
  EVMSignatureHex,
  EVMTransactionHash,
} from "../primitives/index.js";
import type {
  IExecutionPermissionRequest,
  IExecutionPermissionResponse,
  IRevokeExecutionPermissionParams,
  SupportedExecutionPermissions,
} from "./eip7715.js";
import type {
  IGetCallsStatusResult,
  IGetCapabilitiesResult,
  ISendCallsParams,
  ISendCallsResult,
} from "./eip5792.js";
import type { IEVMTransactionRequest } from "./transaction.js";

/**
 * Typed EIP-1193 methods supported by host `EIP1193Provider.request`.
 * Add entries here (with branded params/results) instead of casting at call sites.
 */
export type EIP1193Requests = {
  eth_requestAccounts: {
    result: EVMAccountAddress[];
  };
  eth_accounts: {
    result: EVMAccountAddress[];
  };
  eth_chainId: {
    result: EVMChainId;
  };
  personal_sign: {
    params: readonly [message: string, address: EVMAccountAddress];
    result: EVMSignatureHex;
  };
  eth_signTypedData_v4: {
    params: readonly [address: EVMAccountAddress, typedData: unknown];
    result: EVMSignatureHex;
  };
  eth_sendTransaction: {
    params: readonly [IEVMTransactionRequest];
    result: EVMTransactionHash;
  };
  wallet_switchEthereumChain: {
    params: readonly [{ chainId: EVMChainId }];
    result: null;
  };
  /**
   * EIP-7715: `params` is the permission request array itself
   * (not wrapped in an outer tuple element).
   */
  wallet_requestExecutionPermissions: {
    params: readonly IExecutionPermissionRequest[];
    result: IExecutionPermissionResponse[];
  };
  wallet_revokeExecutionPermission: {
    params: readonly [IRevokeExecutionPermissionParams];
    result: null;
  };
  wallet_getSupportedExecutionPermissions: {
    result: SupportedExecutionPermissions;
  };
  wallet_getGrantedExecutionPermissions: {
    result: IExecutionPermissionResponse[];
  };
  /**
   * EIP-5792. Address is required once a session exists; chain ids are optional.
   * An empty tuple is accepted and resolved to the connected account.
   */
  wallet_getCapabilities: {
    params:
      | readonly []
      | readonly [address: EVMAccountAddress]
      | readonly [address: EVMAccountAddress, chainIds: readonly EVMChainId[]];
    result: IGetCapabilitiesResult;
  };
  wallet_sendCalls: {
    params: readonly [ISendCallsParams];
    result: ISendCallsResult;
  };
  wallet_getCallsStatus: {
    params: readonly [id: string];
    result: IGetCallsStatusResult;
  };
  wallet_showCallsStatus: {
    params: readonly [id: string];
    result: null;
  };
};

export type KnownEIP1193Method = keyof EIP1193Requests;

export type EIP1193RequestArgsFor<M extends KnownEIP1193Method> =
  EIP1193Requests[M] extends { params: infer P }
    ? { method: M; params: P }
    : { method: M; params?: readonly [] };

/** Fallback for wallet-specific or not-yet-mapped EIP-1193 methods. */
export type EIP1193RequestArgs = {
  method: string;
  params?: readonly unknown[] | Record<string, unknown>;
};

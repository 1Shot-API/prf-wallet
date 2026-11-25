import { RPCCallId } from "../primitives/index.js";

/** Postmate emit event name for async RPC callbacks (child → host). */
export const OWS_RPC_CALLBACK_EVENT = "ows:rpcCallback" as const;

/** JSON-RPC method not found */
export const RPC_ERROR_UNIMPLEMENTED = -32_601;

/** JSON-RPC invalid params */
export const RPC_ERROR_INVALID_PARAMS = -32_602;

/** EIP-1193 user rejected request */
export const RPC_ERROR_USER_REJECTED = 4001;

/** EIP-1193 unauthorized — account is not connected. */
export const RPC_ERROR_UNAUTHORIZED = 4100;

/** EIP-5792: capability was not marked optional and is not supported. */
export const RPC_ERROR_UNSUPPORTED_CAPABILITY = 5700;

/** EIP-5792: `wallet_sendCalls` chain id is not supported. */
export const RPC_ERROR_UNSUPPORTED_CHAIN = 5710;

/** EIP-5792: this sender already submitted a bundle with this id. */
export const RPC_ERROR_DUPLICATE_ID = 5720;

/** EIP-5792: bundle id is unknown to this wallet. */
export const RPC_ERROR_UNKNOWN_BUNDLE_ID = 5730;

/** EIP-5792: call bundle exceeds what the wallet will process. */
export const RPC_ERROR_BUNDLE_TOO_LARGE = 5740;

/** EIP-5792: user rejected the upgrade required for atomic execution. */
export const RPC_ERROR_ATOMIC_UPGRADE_REJECTED = 5750;

/** EIP-5792: `atomicRequired` is true and the wallet cannot execute atomically. */
export const RPC_ERROR_ATOMICITY_NOT_SUPPORTED = 5760;

export type RpcErrorPayload = {
  code: number;
  message: string;
  data?: unknown;
};

export type RpcRequestEnvelope = {
  callId: RPCCallId;
  method: string;
  params: unknown;
};

export type RpcResponseEnvelope = {
  callId: RPCCallId;
  success: boolean;
  result?: unknown;
  error?: RpcErrorPayload;
};

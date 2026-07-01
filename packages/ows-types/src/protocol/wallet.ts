import { RPCCallId } from "../primitives/index.js";

/** Postmate emit event name for async RPC callbacks (child → host). */
export const OWS_RPC_CALLBACK_EVENT = "ows:rpcCallback" as const;

export const DEFAULT_RPC_TIMEOUT_MS = 120_000;

/** JSON-RPC method not found */
export const RPC_ERROR_UNIMPLEMENTED = -32_601;

/** JSON-RPC invalid params */
export const RPC_ERROR_INVALID_PARAMS = -32_602;

/** EIP-1193 user rejected request */
export const RPC_ERROR_USER_REJECTED = 4001;

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

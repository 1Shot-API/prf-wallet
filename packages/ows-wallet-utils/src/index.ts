export { OWSWallet } from "./ows-wallet.js";
export type {
  DisplaySession,
  Eip1193Handler,
  OWSWalletOptions,
  RequestDisplayParams,
  RpcHandlerRegistration,
} from "./ows-wallet.js";

export {
  OWS_RPC_CALLBACK_EVENT,
  DEFAULT_RPC_TIMEOUT_MS,
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
  serializeRpc,
  deserializeRpcRequest,
  deserializeRpcResponse,
} from "@1shotapi/ows-types";

export type {
  RpcRequestEnvelope,
  RpcResponseEnvelope,
  RpcErrorPayload,
} from "@1shotapi/ows-types";

export { EIP1193_METHODS, isEip1193Method } from "./eip1193/methods.js";
export type { Eip1193Method } from "./eip1193/methods.js";
export { EIP1193_PARAM_SCHEMAS, getEip1193ParamSchema } from "./eip1193/schemas.js";

export { runHandler } from "./rpc/handler.js";
export { handleRpcModelCall } from "./rpc/child-wrapper.js";
export type { RpcModelRegistration } from "./rpc/child-wrapper.js";
export { debugLog, isOwsWalletDebugEnabled } from "./debug.js";

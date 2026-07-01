export { OWSProxy } from "./ows-proxy.js";
export type { OWSProxyOptions } from "./ows-proxy.js";
export {
  EIP1193Provider,
  type EIP1193RequestArgs,
  type EIP1193Requests,
  type EvmSignatureHex,
  type KnownEIP1193Method,
} from "./eip1193/provider.js";

export {
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
} from "@1shotapi/ows-types";

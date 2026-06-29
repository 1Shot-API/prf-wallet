export { OWSProxy } from "./ows-proxy.js";
export type { OWSProxyOptions } from "./ows-proxy.js";
export type { EIP1193Provider, EIP1193RequestArgs } from "./eip1193/provider.js";
export { createEip1193Provider } from "./eip1193/provider.js";

export {
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
} from "@1shotapi/ows-types";

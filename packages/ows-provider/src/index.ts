export { OWSProxy } from "./ows-proxy.js";
export type { OWSProxyOptions } from "./ows-proxy.js";
export {
  DEFAULT_WALLET_SIZE_X,
  DEFAULT_WALLET_SIZE_Y,
} from "./display/host-handler.js";
export {
  EIP1193Provider,
  type EIP1193RequestArgs,
  type EIP1193Requests,
  type KnownEIP1193Method,
} from "./eip1193/provider.js";

export { CredentialHostClient } from "./credentials/host-client.js";

export type {
  OpenWalletCredentialProvider,
  CredentialOfferInput,
  CredentialReceipt,
  PresentationRequestInput,
  PresentationResult,
  CredentialFilter,
  CredentialSummary,
  CredentialPresentationApprovalRequest,
  CREDENTIAL_WIRE_METHODS,
} from "@1shotapi/ows-credentials";

export {
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
} from "@1shotapi/ows-types";

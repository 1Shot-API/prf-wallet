export { OWSProxy } from "./ows-proxy.js";
export type { OWSProxyOptions } from "./ows-proxy.js";
export {
  DEFAULT_WALLET_SIZE_X,
  DEFAULT_WALLET_SIZE_Y,
  EWalletPresentationMode,
} from "./display/host-handler.js";
export {
  EIP1193Provider,
} from "./eip1193/provider.js";
export { Eip1193EventHostHandler } from "./eip1193/event-host-handler.js";

export { CredentialHostClient } from "./credentials/host-client.js";
export {
  AnalyticsHostHandler,
  type AnalyticsListener,
} from "./analytics/host-handler.js";
export {
  verifySdJwtVcPresentation,
  type VerifySdJwtVcPresentationInput,
  type VerifySdJwtVcPresentationResult,
} from "./credentials/verify.js";

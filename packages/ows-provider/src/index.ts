export { OWSProxy } from "./OWSProxy.js";
export type { OWSProxyOptions } from "./OWSProxy.js";
export {
  DEFAULT_WALLET_SIZE_X,
  DEFAULT_WALLET_SIZE_Y,
  EWalletPresentationMode,
} from "./display/DisplayHostHandler.js";
export {
  EIP1193Provider,
} from "./eip1193/EIP1193Provider.js";
export { Eip1193EventHostHandler } from "./eip1193/Eip1193EventHostHandler.js";

export { CredentialHostClient } from "./credentials/CredentialsHostClient.js";
export { BitcoinHostClient } from "./bitcoin/BitcoinHostClient.js";
export {
  SolanaHostClient,
  type RegisterSolanaWalletOptions,
} from "./solana/SolanaHostClient.js";
export {
  OwsSolanaStandardWallet,
  SOLANA_STANDARD_CHAINS,
  type OwsSolanaStandardWalletOptions,
} from "./solana/standard-wallet.js";
export {
  AnalyticsHostHandler,
  type AnalyticsListener,
} from "./analytics/AnalyticsHostHandler.js";
export {
  verifySdJwtVcPresentation,
  type VerifySdJwtVcPresentationInput,
  type VerifySdJwtVcPresentationResult,
} from "./credentials/verify.js";

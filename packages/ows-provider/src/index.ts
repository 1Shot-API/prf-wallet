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
export {
  verifySdJwtVcPresentation,
  type VerifySdJwtVcPresentationInput,
  type VerifySdJwtVcPresentationResult,
} from "./credentials/verify.js";

export {
  CREDENTIAL_WIRE_METHODS,
  type OpenWalletCredentialProvider,
  type CredentialOfferInput,
  type CredentialReceipt,
  type PresentationRequestInput,
  type PresentationResult,
  type CredentialFilter,
  type CredentialSummary,
  type CredentialPresentationApprovalRequest,
  type StoredCredential,
  type CredentialStore,
  type HolderSigner,
  type Oid4vciClient,
  type Oid4vpClient,
} from "@1shotapi/ows-types";

export {
  buildSdJwtVcPresentation,
  createOwsEd25519HolderSigner,
  extractHolderJwkFromSdJwtVc,
  type BuildSdJwtVcPresentationInput,
  type BuildSdJwtVcPresentationResult,
  type OwsEd25519SignerDeps,
} from "@1shotapi/ows-wallet-utils";

export {
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
} from "@1shotapi/ows-types";

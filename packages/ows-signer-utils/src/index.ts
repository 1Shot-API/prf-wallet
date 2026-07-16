export { OWSSigner, type OWSSignerOptions } from "./owssigner.js";
export {
  createSignerIframe,
  getSignerOrigin,
  overlaySignerIframe,
  prepareSignerIframeForWebAuthn,
  type CreateSignerIframeOptions,
  type OverlaySignerIframeOptions,
} from "./iframe.js";
export {
  SignHelper,
  parseTypedData,
  type Eip1193Handler,
  type Eip1193SignHandlers,
  type SignHelperDisplaySession,
  type SignHelperDisplaySize,
  type SignHelperOptions,
  type SignHelperSigner,
  type SignHelperWallet,
} from "./eip1193/sign-helper.js";
export type {
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
  SignTypedDataPayload,
} from "./eip1193/approval-types.js";
export {
  OwsSignerError,
  OwsInvalidRequestError,
  OwsNotAllowedError,
  OwsTimeoutError,
} from "./errors.js";
export { EvmSigner, type EvmCallOptions } from "./evm/namespace.js";
export { toViemLocalAccount } from "./evm/to-viem-account.js";
export { SolanaSigner, type SolanaCallOptions } from "./solana/namespace.js";
export { addressFromEd25519PublicKey } from "./solana/address.js";
export {
  keyDerivedDataFromEvent,
  publicKeyDataFromEvent,
  credentialCreatedDataFromEvent,
} from "./rpc/client.js";
export { COSEToSPKIPublicKey } from "./webauthn/cose-to-spki.js";

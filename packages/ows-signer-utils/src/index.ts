export { OWSSigner, type OWSSignerOptions } from "./owssigner.js";
export {
  createSignerIframe,
  getSignerOrigin,
  overlaySignerIframe,
  showSignerCeremonyPanel,
  type CreateSignerIframeOptions,
  type OverlaySignerIframeOptions,
} from "./iframe.js";
export {
  SignHelper,
  parseTypedData,
  prepareEvmTransaction,
  type Eip1193Handler,
  type Eip1193SignHandlers,
  type SignHelperChainRpc,
  type SignHelperDisplaySession,
  type SignHelperOptions,
  type SignHelperSigner,
  type SignHelperWallet,
} from "./eip1193/sign-helper.js";
export type {
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignTypedDataApprovalRequest,
  SignTypedDataPayload,
} from "./eip1193/approval-types.js";
export {
  OwsSignerError,
  OwsInvalidRequestError,
  OwsNotAllowedError,
  OwsSignDeniedError,
  OwsTimeoutError,
} from "./errors.js";
export { EvmSigner, type EvmCallOptions } from "./evm/namespace.js";
export {
  toViemLocalAccount,
  type ToViemLocalAccountOptions,
} from "./evm/to-viem-account.js";
export { SolanaSigner, type SolanaCallOptions } from "./solana/namespace.js";
export { addressFromEd25519PublicKey } from "./solana/address.js";
export { BitcoinSigner, type BitcoinCallOptions } from "./bitcoin/namespace.js";
export {
  addressFromSecp256k1PublicKey,
  compressSecp256k1PublicKey,
  bitcoinNetworkForChainId,
} from "./bitcoin/address.js";
export {
  prepareBitcoinTransaction,
  finalizeBitcoinTransaction,
  type IBitcoinTransactionInput,
  type IBitcoinTransactionOutput,
  type IBitcoinUnsignedTransaction,
  type IBitcoinSignedTransactionResult,
  type IPreparedBitcoinTransaction,
} from "./bitcoin/marshal.js";
export {
  keyDerivedDataFromEvent,
  publicKeyDataFromEvent,
  credentialCreatedDataFromEvent,
} from "./rpc/client.js";
export { COSEToSPKIPublicKey } from "./webauthn/cose-to-spki.js";

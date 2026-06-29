export { OWSSigner, type OWSSignerOptions } from "./owssigner.js";
export type { OwsSignerHostConfig, OwsSignerEvmApi } from "./owssigner.js";
export {
  OwsSignerError,
  OwsInvalidRequestError,
  OwsNotAllowedError,
  OwsTimeoutError,
} from "./errors.js";
export type {
  CreateCredentialOptions,
  CredentialCreatedData,
  DigestSignedData,
  GetPublicKeyParams,
  PublicKeyData,
  RecoveryDataCreatedData,
  SignScheme,
  SignerEvent,
  SignerMethod,
  VersionData,
} from "./rpc/types.js";
export { EvmSigner, type EvmCallOptions } from "./evm/namespace.js";
export { toViemLocalAccount } from "./evm/to-viem-account.js";

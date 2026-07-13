export { OwsError } from "./errors/base.js";

export {
  OwsRpcError,
  OwsUnimplementedError,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  OwsRpcTimeoutError,
} from "./errors/rpc.js";

export {
  OwsSignerError,
  OwsNotAllowedError,
  OwsInvalidRequestError,
  OwsTimeoutError,
} from "./errors/signer.js";

export {
  OWS_RPC_CALLBACK_EVENT,
  DEFAULT_RPC_TIMEOUT_MS,
  RPC_ERROR_UNIMPLEMENTED,
  RPC_ERROR_INVALID_PARAMS,
  RPC_ERROR_USER_REJECTED,
} from "./protocol/wallet.js";

export {
  OWS_REQUEST_DISPLAY_EVENT,
  OWS_RELEASE_DISPLAY_EVENT,
  OWS_REQUEST_HIDE_EVENT,
  OWS_DISPLAY_READY_MODEL_METHOD,
  OWS_HIDE_READY_MODEL_METHOD,
  DEFAULT_DISPLAY_TIMEOUT_MS,
  deserializeRequestDisplay,
  deserializeDisplayReady,
  deserializeReleaseDisplay,
  deserializeRequestHide,
  deserializeHideReady,
} from "./protocol/display.js";

export type {
  RequestDisplayParams,
  RequestDisplayEnvelope,
  DisplayReadyPayload,
  ReleaseDisplayEnvelope,
  RequestHideEnvelope,
  HideReadyPayload,
} from "./protocol/display.js";

export type {
  RpcErrorPayload,
  RpcRequestEnvelope,
  RpcResponseEnvelope,
} from "./protocol/wallet.js";

export {
  serializeRpc,
  deserializeRpcRequest,
  deserializeRpcResponse,
} from "./protocol/serde.js";

export { API_VERSION } from "./protocol/signer.js";

export type {
  SignScheme,
  SignerMethod,
  SignerEvent,
  SignerRequest,
  SignerEventMessage,
  VersionData,
  KeyDerivedData,
  CredentialCreatedData,
  DigestSignedData,
  RecoveryDataCreatedData,
  RecoverySessionStartedData,
  RecoverySessionClearedData,
  PublicKeyData,
  ChallengeSignedData,
  CreateCredentialOptions,
  GetPublicKeyParams,
} from "./protocol/signer.js";

export {
  CREDENTIAL_WIRE_METHODS,
  type CredentialWireMethod,
  type OpenWalletCredentialProvider,
} from "./protocol/credentials.js";

export * from "./credentials/index.js";

export * from "./primitives/index.js";

export {
  buildSdJwtVcPresentation,
  extractHolderJwkFromSdJwtVc,
  sdJwtHasher,
  sdJwtSaltGenerator,
  createEd25519SignerFromJwk,
  createEd25519VerifierFromJwk,
  signEd25519,
  holderSignerToKbSigner,
  type BuildSdJwtVcPresentationInput,
  type BuildSdJwtVcPresentationResult,
} from "./utils/index.js";

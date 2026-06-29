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

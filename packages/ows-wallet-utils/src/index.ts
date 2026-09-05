export { OWSWallet } from "./ows-wallet.js";
export type {
  DisplaySession,
  Eip1193Handler,
  OWSWalletOptions,
  RequestDisplayParams,
  RpcHandlerRegistration,
} from "./ows-wallet.js";

export { AnalyticsChildClient } from "./analytics/child-client.js";
export { Eip1193EventChildClient } from "./eip1193/event-child-client.js";

export { EIP1193_PARAM_SCHEMAS, getEip1193ParamSchema } from "./eip1193/schemas.js";
export {
  RpcHelper,
  RpcHelperEventEmitter,
  normalizeChainId,
} from "./eip1193/rpc-helper.js";
export type {
  RpcHelperEventMap,
  RpcHelperExecutionPermissionsHooks,
  RpcHelperOptions,
  RpcHelperSigner,
  RpcHelperWallet,
} from "./eip1193/rpc-helper.js";

export { runHandler } from "./rpc/handler.js";
export { handleRpcModelCall } from "./rpc/child-wrapper.js";
export type { RpcModelRegistration } from "./rpc/child-wrapper.js";
export { debugLog, isOwsWalletDebugEnabled } from "./debug.js";

export {
  AddressUtils,
} from "./AddressUtils.js";
export {
  IBlockchainProviderType,
  type IBlockchainProvider,
} from "./IBlockchainProvider.js";

export {
  CREDENTIAL_PARAM_SCHEMAS,
  acceptOfferParamsSchema,
  presentParamsSchema,
  listParamsSchema,
  deleteParamsSchema,
} from "./credentials/schemas.js";
export { CredentialWalletRegistrar } from "./credentials/wallet-registrar.js";

export {
  BITCOIN_PARAM_SCHEMAS,
  getAccountAddressesParamsSchema,
  BitcoinWalletRegistrar,
} from "./bitcoin/wallet-registrar.js";

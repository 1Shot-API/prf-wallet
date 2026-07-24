import {
  SignHelper,
  prepareEvmTransaction,
} from "@1shotapi/ows-signer-utils";
import type {
  OWSSigner,
  PersonalSignApprovalRequest,
  SendTransactionApprovalRequest,
  SignHelperChainRpc,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  EVMTransactionHash,
  OwsInvalidParamsError,
  OwsUserRejectedError,
  type EVMTransactionHash as EVMTransactionHashType,
} from "@1shotapi/ows-types";

export type RegisterApprovalSigningOptions = {
  /**
   * Setup-only gate for signed actions: run onboarding when no credential
   * exists. With a known credential, skip unlock — the signing ceremony
   * authenticates. Pair with {@link onAuthenticated}.
   */
  ensureReady?: () => Promise<void>;
  /** Mark unlocked + refresh addresses after a successful signing ceremony. */
  onAuthenticated?: () => void | Promise<void>;
  chainRpc: SignHelperChainRpc;
  requestPersonalSignApproval: (
    request: PersonalSignApprovalRequest,
  ) => Promise<boolean>;
  requestSignTypedDataApproval: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<boolean>;
  /**
   * Consent UI for eth_sendTransaction. When approved, branding continues with
   * prepare + sign + broadcast (default implementation below if omitted).
   */
  requestSendTransactionApproval: (
    request: SendTransactionApprovalRequest,
  ) => Promise<boolean>;
  /**
   * Full send path. Defaults to modal consent + prepare + sign + eth_sendRawTransaction.
   */
  approveAndSignTransaction?: (
    request: SendTransactionApprovalRequest,
  ) => Promise<EVMTransactionHashType>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const approveAndSignTransaction =
    options.approveAndSignTransaction ??
    (async (request: SendTransactionApprovalRequest) => {
      const approved = await options.requestSendTransactionApproval(request);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected the transaction request");
      }

      const prepared = await prepareEvmTransaction(
        options.chainRpc,
        request.address,
        request.transaction,
      );
      const [signed] = await signer.evm.signTransaction([prepared]);
      await options.onAuthenticated?.();

      const hash = await options.chainRpc.request("eth_sendRawTransaction", [
        signed,
      ]);
      if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
        throw new OwsInvalidParamsError(
          "eth_sendRawTransaction returned an invalid transaction hash",
        );
      }
      return EVMTransactionHash(hash as `0x${string}`);
    });

  const helper = new SignHelper(signer, wallet, {
    ensureReady: options.ensureReady,
    onAuthenticated: options.onAuthenticated,
    getChainId: () => options.chainRpc.getChainId(),
    requestPersonalSignApproval: options.requestPersonalSignApproval,
    requestSignTypedDataApproval: options.requestSignTypedDataApproval,
    approveAndSignTransaction,
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}

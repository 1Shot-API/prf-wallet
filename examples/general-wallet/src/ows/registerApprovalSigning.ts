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
  type EVMSignatureHex,
  type EVMTransactionHash as EVMTransactionHashType,
} from "@1shotapi/ows-types";

export type RegisterApprovalSigningOptions = {
  /**
   * Setup-only gate before signed actions: run onboarding when no credential
   * exists. With a known credential, skip unlock — the signing ceremony
   * authenticates. Pair with {@link onAuthenticated}.
   */
  ensureReady?: () => Promise<void>;
  /** Mark unlocked + refresh addresses after a successful signing ceremony. */
  onAuthenticated?: () => void | Promise<void>;
  chainRpc: SignHelperChainRpc;
  /**
   * Branding owns consent UI + `signMessage`. Keep the view open until the
   * Signing Layer ceremony finishes.
   */
  approveAndSignPersonalMessage: (
    request: PersonalSignApprovalRequest,
  ) => Promise<EVMSignatureHex>;
  /**
   * Branding owns consent UI + `signTypedData`. Keep the view open until the
   * Signing Layer ceremony finishes.
   */
  approveAndSignTypedData: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<EVMSignatureHex>;
  /**
   * Full send path (consent + prepare + sign + broadcast). Defaults to
   * {@link requestSendTransactionApproval} + prepare/sign/broadcast when
   * omitted — prefer an implementation that keeps consent UI mounted during
   * the ceremony.
   */
  requestSendTransactionApproval?: (
    request: SendTransactionApprovalRequest,
  ) => Promise<boolean>;
  approveAndSignTransaction?: (
    request: SendTransactionApprovalRequest,
  ) => Promise<EVMTransactionHashType>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 *
 * SignHelper only adapts EIP-1193 ↔ `approveAndSign*`. Setup / unlock live here
 * so branding owns the link to `OWSSigner`.
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const approveAndSignTransaction =
    options.approveAndSignTransaction ??
    (async (request: SendTransactionApprovalRequest) => {
      const requestApproval = options.requestSendTransactionApproval;
      if (!requestApproval) {
        throw new OwsInvalidParamsError(
          "approveAndSignTransaction or requestSendTransactionApproval is required",
        );
      }
      const approved = await requestApproval(request);
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
    getChainId: () => options.chainRpc.getChainId(),
    approveAndSignPersonalMessage: async (request) => {
      await options.ensureReady?.();
      const signature = await options.approveAndSignPersonalMessage(request);
      await options.onAuthenticated?.();
      return signature;
    },
    approveAndSignTypedData: async (request) => {
      await options.ensureReady?.();
      const signature = await options.approveAndSignTypedData(request);
      await options.onAuthenticated?.();
      return signature;
    },
    approveAndSignTransaction: async (request) => {
      await options.ensureReady?.();
      return approveAndSignTransaction(request);
    },
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}

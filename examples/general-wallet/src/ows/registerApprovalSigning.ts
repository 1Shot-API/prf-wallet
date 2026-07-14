import { SignHelper } from "@1shotapi/ows-signer-utils";
import type {
  OWSSigner,
  PersonalSignApprovalRequest,
  SignTypedDataApprovalRequest,
} from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";

export type RegisterApprovalSigningOptions = {
  ensureReady?: () => Promise<void>;
  requestPersonalSignApproval: (
    request: PersonalSignApprovalRequest,
  ) => Promise<boolean>;
  requestSignTypedDataApproval: (
    request: SignTypedDataApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterApprovalSigningOptions,
): SignHelper {
  const helper = new SignHelper(signer, wallet, {
    ensureReady: options.ensureReady,
    requestPersonalSignApproval: options.requestPersonalSignApproval,
    requestSignTypedDataApproval: options.requestSignTypedDataApproval,
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}

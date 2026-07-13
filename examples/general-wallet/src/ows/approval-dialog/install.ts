/**
 * Example-local wiring for EIP-1193 personal_sign / typed-data via SignHelper.
 * Dialog DOM stays in `./dialog.ts`; protocol orchestration is in ows-signer-utils.
 */
import { SignHelper } from "@1shotapi/ows-signer-utils";
import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  requestPersonalSignApproval,
  requestSignTypedDataApproval,
} from "./dialog";

export type WireApprovalSigningOptions = {
  /** Override dialog mount target. */
  container?: HTMLElement;
  /** Run before signing (e.g. passkey unlock). */
  ensureReady?: () => Promise<void>;
};

/**
 * Build SignHelper handlers and register them on the wallet (pre-`start()`).
 * Transaction signing is intentionally omitted.
 */
export function registerApprovalSigning(
  wallet: OWSWallet,
  signer: OWSSigner,
  options?: WireApprovalSigningOptions,
): SignHelper {
  const helper = new SignHelper(signer, wallet, {
    ensureReady: options?.ensureReady,
    requestPersonalSignApproval: (request) =>
      requestPersonalSignApproval(request, { container: options?.container }),
    requestSignTypedDataApproval: (request) =>
      requestSignTypedDataApproval(request, { container: options?.container }),
  });

  for (const [method, handler] of Object.entries(helper.handlers)) {
    wallet.registerEip1193(method, handler);
  }

  return helper;
}

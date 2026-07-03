import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { EVMAccountAddress } from "@1shotapi/ows-types";

/** When the module may register handlers on `OWSWallet`. */
export type BrandingModulePhase = "pre-start" | "post-start";

export type PersonalSignApprovalRequest = {
  message: string;
  address: EVMAccountAddress;
};

/** Host-provided UI surface; registry modules may implement defaults. */
export type UiHost = {
  requestPersonalSignApproval(
    request: PersonalSignApprovalRequest,
  ): Promise<boolean>;
};

/** Wallet surface registry modules may call (subset of `OWSWallet`). */
export type BrandingWalletHost = Pick<
  OWSWallet,
  "registerEip1193" | "requestDisplay" | "requestHide"
>;

/** Signer surface registry modules may call (subset of `OWSSigner`). */
export type BrandingSignerHost = {
  evm: Pick<OWSSigner["evm"], "signMessage">;
};

export type BrandingContext = {
  wallet: BrandingWalletHost;
  signer: BrandingSignerHost;
  /** Override or extend default UI provided by modules. */
  ui?: Partial<UiHost>;
  /** Run before connect/sign (e.g. passkey onboarding). */
  ensureReady?: () => Promise<void>;
};

export type BrandingModule = {
  name: string;
  phase: BrandingModulePhase;
  install(ctx: BrandingContext): void | Promise<void>;
};

import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import type { EVMAccountAddress } from "@1shotapi/ows-types";

/** When the module may register handlers on `OWSWallet`. */
export type BrandingModulePhase = "pre-start" | "post-start";

export type PersonalSignApprovalRequest = {
  message: string;
  address: EVMAccountAddress;
};

/** EIP-712 typed data payload (eth_signTypedData / _v3 / _v4). */
export type SignTypedDataPayload = {
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  domain: Record<string, unknown>;
  message: Record<string, unknown>;
};

export type SignTypedDataApprovalRequest = {
  address: EVMAccountAddress;
  typedData: SignTypedDataPayload;
};

export type CreateBackupResult = {
  encryptedPrivateKey: string;
};

/** Host-provided UI surface; registry modules may implement defaults. */
export type UiHost = {
  requestPersonalSignApproval(
    request: PersonalSignApprovalRequest,
  ): Promise<boolean>;
  requestSignTypedDataApproval(
    request: SignTypedDataApprovalRequest,
  ): Promise<boolean>;
  /** Present the encrypted recovery blob after create-backup succeeds. */
  showCreateBackupResult(result: CreateBackupResult): Promise<void>;
};

/** Wallet surface registry modules may call (subset of `OWSWallet`). */
export type BrandingWalletHost = Pick<
  OWSWallet,
  "registerEip1193" | "requestDisplay" | "requestHide"
>;

/** Signer surface registry modules may call (subset of `OWSSigner`). */
export type BrandingSignerHost = {
  evm: Pick<OWSSigner["evm"], "signMessage" | "signTypedData">;
  createRecoveryData: OWSSigner["createRecoveryData"];
  recoverKey: OWSSigner["recoverKey"];
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

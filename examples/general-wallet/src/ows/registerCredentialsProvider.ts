import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialsHelper,
  type CredentialsHelperOptions,
} from "@1shotapi/ows-oid4";
import {
  type CredentialOfferApprovalRequest,
  type CredentialPresentationApprovalRequest,
  type ICredentialRepository,
  type ICredentialStatusValidator,
  type IHolderSigner,
  type IIssuerTrustRegistry,
  type IOid4vciClient,
  type IOid4vpClient,
  type IWalletAttestationProvider,
  type IssuerMetadata,
} from "@1shotapi/ows-types";

export type RegisterCredentialsProviderOptions = {
  repository: ICredentialRepository;
  oid4vci: IOid4vciClient;
  oid4vp: IOid4vpClient;
  trust: IIssuerTrustRegistry;
  status?: ICredentialStatusValidator;
  holderSigner?: IHolderSigner | (() => Promise<IHolderSigner>);
  getProofNonce?: (metadata: IssuerMetadata) => string | Promise<string>;
  attestationProvider?: IWalletAttestationProvider;
  ensureReady?: () => Promise<void>;
  requestCredentialOfferApproval?: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval?: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register wallet.credentials handlers via {@link CredentialsHelper}
 * (call before `wallet.start()`).
 */
export function registerCredentialsProvider(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCredentialsProviderOptions,
): CredentialsHelper {
  const helperOptions: CredentialsHelperOptions = {
    repository: options.repository,
    oid4vci: options.oid4vci,
    oid4vp: options.oid4vp,
    trust: options.trust,
    status: options.status,
    holderSigner: options.holderSigner,
    getProofNonce: options.getProofNonce,
    attestationProvider: options.attestationProvider,
    ensureReady: options.ensureReady,
    requestCredentialOfferApproval: options.requestCredentialOfferApproval,
    requestCredentialPresentationApproval:
      options.requestCredentialPresentationApproval,
  };
  const helper = new CredentialsHelper(wallet, signer, helperOptions);
  helper.register();
  return helper;
}

import type { OWSSigner } from "@1shotapi/ows-signer-utils";
import type { OWSWallet } from "@1shotapi/ows-wallet-utils";
import {
  CredentialsHelper,
  createCredentialsHolderSigner,
  issueCredentialAfterApproval,
  presentCredentialAfterApproval,
  type ApproveAndAcceptOfferRequest,
  type ApproveAndPresentRequest,
} from "@1shotapi/ows-oid4";
import {
  OwsUserRejectedError,
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
import { isWalletCreated } from "../storage";

export type RegisterCredentialsProviderOptions = {
  repository: ICredentialRepository;
  oid4vci: IOid4vciClient;
  oid4vp: IOid4vpClient;
  trust: IIssuerTrustRegistry;
  status?: ICredentialStatusValidator;
  holderSigner?: IHolderSigner | (() => Promise<IHolderSigner>);
  getProofNonce?: (metadata: IssuerMetadata) => string | Promise<string>;
  attestationProvider?: IWalletAttestationProvider;
  /**
   * Full unlock/setup — used when the local vault is empty (recover) or for
   * credential delete. Prefer setup-only {@link ensureOnboarded} for issue PoP.
   */
  ensureReady?: () => Promise<void>;
  /**
   * Setup-only when no credential exists. With a known passkey, skip unlock —
   * the PoP ceremony authenticates. Pair with {@link onAuthenticated}.
   */
  ensureOnboarded?: () => Promise<void>;
  /** Mark unlocked after a successful PoP / issue ceremony. */
  onAuthenticated?: () => void | Promise<void>;
  requestCredentialOfferApproval?: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval?: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
};

/**
 * Register `wallet.credentials` via {@link CredentialsHelper} (pre-`start()`).
 *
 * Helper only resolves/match/trust + display. Branding `approveAnd*` owns consent,
 * setup, and PoP (SignHelper parity).
 */
export function registerCredentialsProvider(
  wallet: OWSWallet,
  signer: OWSSigner,
  options: RegisterCredentialsProviderOptions,
): CredentialsHelper {
  const resolveHolderSigner = createCredentialsHolderSigner(
    signer,
    options.holderSigner,
  );

  const approveAndAcceptOffer = async (
    request: ApproveAndAcceptOfferRequest,
  ) => {
    await (options.ensureOnboarded ?? options.ensureReady)?.();
    if (options.requestCredentialOfferApproval) {
      const approved = await options.requestCredentialOfferApproval(request);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential offer");
      }
    }
    const receipt = await issueCredentialAfterApproval({
      offer: request.offer,
      metadata: request.metadata,
      oid4vci: options.oid4vci,
      repository: options.repository,
      resolveHolderSigner,
      getProofNonce: options.getProofNonce,
      attestationProvider: options.attestationProvider,
      status: options.status,
    });
    await options.onAuthenticated?.();
    return receipt;
  };

  const approveAndPresent = async (request: ApproveAndPresentRequest) => {
    if (options.requestCredentialPresentationApproval) {
      const approved =
        await options.requestCredentialPresentationApproval(request);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential presentation");
      }
    }
    const result = await presentCredentialAfterApproval({
      definition: request.definition,
      credential: request.credential,
      oid4vp: options.oid4vp,
      resolveHolderSigner,
      attestationProvider: options.attestationProvider,
    });
    await options.onAuthenticated?.();
    return result;
  };

  const helper = new CredentialsHelper(wallet, {
    repository: options.repository,
    oid4vci: options.oid4vci,
    oid4vp: options.oid4vp,
    trust: options.trust,
    status: options.status,
    approveAndAcceptOffer,
    approveAndPresent,
  });

  const ensureReady = options.ensureReady ?? (async () => {});

  wallet.credentials.register({
    acceptOffer: (input) => helper.handlers.acceptOffer(input),
    present: async (input) => {
      // Empty local vault (new top-level origin) — unlock/recover before match.
      if (!isWalletCreated()) {
        await ensureReady();
      } else {
        const listed = await options.repository.list();
        if (listed.length === 0) {
          await ensureReady();
        }
      }
      return helper.handlers.present(input);
    },
    list: (filter) => helper.handlers.list(filter),
    delete: async (input) => {
      await ensureReady();
      return helper.handlers.delete(input);
    },
  });

  return helper;
}

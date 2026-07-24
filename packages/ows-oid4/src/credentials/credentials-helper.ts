import {
  CredentialFormatId,
  CredentialTypeName,
  HexString,
  OwsUserRejectedError,
  NoopCredentialStatusValidator,
  ProofUtils,
  CredentialCryptoUtils,
  type CredentialOffer,
  type CredentialOfferApprovalRequest,
  type CredentialOfferInput,
  type CredentialPresentationApprovalRequest,
  type CredentialReceipt,
  type CredentialFilter,
  type CredentialSummary,
  type CredentialId,
  type ICredentialRepository,
  type ICredentialStatusValidator,
  type IHolderSigner,
  type IIssuerTrustRegistry,
  type IOWSSigner,
  type IOid4vciClient,
  type IOid4vpClient,
  type IWalletAttestationProvider,
  type IssuerMetadata,
  type OpenWalletCredentialProvider,
  type PresentationDefinition,
  type PresentationRequestInput,
  type PresentationResult,
  type RequestDisplayParams,
  type StoredCredential,
} from "@1shotapi/ows-types";

export type CredentialsHelperDisplaySession = {
  hide(): Promise<void>;
};

export type CredentialsHelperWallet = {
  requestDisplay(
    params: RequestDisplayParams,
  ): Promise<CredentialsHelperDisplaySession>;
  credentials: {
    register(handlers: OpenWalletCredentialProvider): void;
  };
};

export type CredentialsHelperDisplaySize = {
  width: number;
  height: number;
};

export type CredentialsHelperOptions = {
  repository: ICredentialRepository;
  oid4vci: IOid4vciClient;
  oid4vp: IOid4vpClient;
  trust: IIssuerTrustRegistry;
  status?: ICredentialStatusValidator;
  holderSigner?: IHolderSigner | (() => Promise<IHolderSigner>);
  /**
   * Resolve OID4VCI C-nonce for proof JWTs. Used when the OID4 client does not
   * implement `prepareCredentialRequest` (or returns no `cNonce`).
   */
  getProofNonce?: (metadata: IssuerMetadata) => string | Promise<string>;
  /** Optional wallet attestation for issuance / presentation profiles. */
  attestationProvider?: IWalletAttestationProvider;
  ensureReady?: () => Promise<void>;
  requestCredentialOfferApproval?: (
    request: CredentialOfferApprovalRequest,
  ) => Promise<boolean>;
  requestCredentialPresentationApproval?: (
    request: CredentialPresentationApprovalRequest,
  ) => Promise<boolean>;
  offerDisplaySize?: CredentialsHelperDisplaySize;
  presentDisplaySize?: CredentialsHelperDisplaySize;
  /**
   * When true (default), re-check wallet trust on present after host
   * `acceptedIssuers` filtering.
   */
  recheckTrustOnPresent?: boolean;
};

const DEFAULT_OFFER_SIZE: CredentialsHelperDisplaySize = {
  width: 400,
  height: 460,
};
const DEFAULT_PRESENT_SIZE: CredentialsHelperDisplaySize = {
  width: 420,
  height: 500,
};

/**
 * Coordinates credential accept/present against branding-owned repository,
 * trust, status, OID4 clients, and holder signing. Consent always runs before
 * PoP / requestCredential. Status checks fail closed on non-active.
 */
export class CredentialsHelper {
  readonly handlers: OpenWalletCredentialProvider;

  private readonly status: ICredentialStatusValidator;
  private readonly recheckTrustOnPresent: boolean;

  constructor(
    private readonly wallet: CredentialsHelperWallet,
    private readonly signer: IOWSSigner,
    private readonly options: CredentialsHelperOptions,
  ) {
    this.status = options.status ?? new NoopCredentialStatusValidator();
    this.recheckTrustOnPresent = options.recheckTrustOnPresent !== false;

    this.handlers = {
      acceptOffer: (input) => this.acceptOffer(input),
      present: (input) => this.present(input),
      list: (filter) => this.list(filter),
      delete: (input) => this.delete(input.credentialId),
    };
  }

  /** Register handlers on `wallet.credentials`. */
  register(): void {
    this.wallet.credentials.register(this.handlers);
  }

  private async resolveHolderSigner(): Promise<IHolderSigner> {
    if (this.options.holderSigner) {
      return typeof this.options.holderSigner === "function"
        ? this.options.holderSigner()
        : this.options.holderSigner;
    }

    return CredentialCryptoUtils.createOwsEd25519HolderSigner({
      getEd25519PublicKeyHex: async () => {
        const cached = this.signer.getLastPublicKeyData();
        if (cached?.ed25519PublicKey) {
          return cached.ed25519PublicKey;
        }
        const keys = await this.signer.getPublicKey({
          credentialId: this.signer.getCredentialId(),
        });
        return keys.ed25519PublicKey;
      },
      signDigest: async (digests) => {
        const results = await this.signer.signDigest(
          digests.map((item) => ({
            digestData: HexString(item.digestData),
            scheme: item.scheme ?? "ed25519",
          })),
        );
        return results.map((result) => ({
          signature: HexString(result.signature),
        }));
      },
    });
  }

  private async assertActive(credential: StoredCredential): Promise<void> {
    const check = await this.status.checkStatus(credential);
    if (check.status !== "active") {
      throw new Error(
        `Credential status is ${check.status}${check.details ? `: ${check.details}` : ""}`,
      );
    }
  }

  async acceptOffer(input: CredentialOfferInput): Promise<CredentialReceipt> {
    const uri = input.credentialOfferUri;
    const offer =
      input.offer ?? (uri ? await this.options.oid4vci.resolveOffer(uri) : undefined);
    if (!offer) {
      throw new Error("credentialOfferUri or offer is required");
    }

    const metadata = await this.options.oid4vci.fetchIssuerMetadata(
      offer.credentialIssuer,
    );

    const trusted = await this.options.trust.isTrustedIssuer(
      offer.credentialIssuer,
    );
    if (!trusted) {
      throw new Error(`Untrusted issuer: ${offer.credentialIssuer}`);
    }

    // Unlock / first-run setup before opening the offer flyout so nested
    // setup display cannot tear down the consent session.
    await this.options.ensureReady?.();

    const size = this.options.offerDisplaySize ?? DEFAULT_OFFER_SIZE;
    const display = await this.wallet.requestDisplay(size);
    try {
      const approved = await this.requestOfferApproval(offer, metadata);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential offer");
      }

      const holderSigner = await this.resolveHolderSigner();
      const holderPublicKeyJwk = await holderSigner.publicKeyJwk();

      const prepared = this.options.oid4vci.prepareCredentialRequest
        ? await this.options.oid4vci.prepareCredentialRequest(offer, metadata)
        : undefined;

      const nonce =
        prepared?.cNonce ??
        (this.options.getProofNonce
          ? await this.options.getProofNonce(metadata)
          : undefined);
      if (!nonce) {
        throw new Error(
          "OID4VCI C-nonce required (prepareCredentialRequest or getProofNonce)",
        );
      }

      const walletAttestationJwt = this.options.attestationProvider
        ? await this.options.attestationProvider.createAttestation({
            audience: metadata.credentialIssuer,
            nonce,
          })
        : undefined;

      const proofJwt = await ProofUtils.buildOid4vciProofJwt({
        holderSigner,
        audience: metadata.credentialIssuer,
        nonce,
      });
      const stored = await this.options.oid4vci.requestCredential(offer, metadata, {
        holderPublicKeyJwk,
        proof: { proof_type: "jwt", jwt: proofJwt },
        nonce,
        walletAttestationJwt,
      });
      await this.assertActive(stored);
      await this.options.repository.store(stored);

      return {
        credentialId: stored.credentialId,
        format: stored.format,
        type: stored.type,
      };
    } finally {
      await display.hide();
    }
  }

  async present(input: PresentationRequestInput): Promise<PresentationResult> {
    const uri = input.requestUri;
    const definition =
      input.request ??
      (uri ? await this.options.oid4vp.resolveRequest(uri) : undefined);
    if (!definition) {
      throw new Error("requestUri or request is required");
    }

    let summaries = await this.options.repository.list();
    // Empty cache (e.g. new top-level origin) — unlock / recover before match.
    if (summaries.length === 0) {
      await this.options.ensureReady?.();
      summaries = await this.options.repository.list();
    }

    let matches = await this.options.oid4vp.matchCredentials(
      definition,
      summaries,
    );

    if (input.acceptedIssuers && input.acceptedIssuers.length > 0) {
      const allowed = new Set(input.acceptedIssuers);
      matches = matches.filter((m) => allowed.has(m.issuer));
    }

    if (this.recheckTrustOnPresent) {
      const trusted: typeof matches = [];
      for (const match of matches) {
        if (await this.options.trust.isTrustedIssuer(match.issuer)) {
          trusted.push(match);
        }
      }
      matches = trusted;
    }

    if (matches.length === 0) {
      throw new Error("No matching credentials in wallet");
    }

    const match = matches[0]!;
    const size = this.options.presentDisplaySize ?? DEFAULT_PRESENT_SIZE;
    const display = await this.wallet.requestDisplay(size);
    try {
      const approved = await this.requestPresentationApproval(definition, match);
      if (!approved) {
        throw new OwsUserRejectedError("User rejected credential presentation");
      }

      await this.options.ensureReady?.();

      const credential = await this.options.repository.get(match.credentialId);
      if (!credential) {
        throw new Error("Credential not found");
      }

      await this.assertActive(credential);

      const holderSigner = await this.resolveHolderSigner();
      const authorizationRequest =
        this.options.oid4vp.getAuthorizationRequest?.(definition.id);
      return this.options.oid4vp.buildPresentation(credential, definition, {
        holderSigner,
        attestationProvider: this.options.attestationProvider,
        authorizationRequest,
      });
    } finally {
      await display.hide();
    }
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return this.options.repository.list(filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    await this.options.repository.delete(credentialId);
  }

  private async requestOfferApproval(
    offer: CredentialOffer,
    metadata: IssuerMetadata,
  ): Promise<boolean> {
    if (!this.options.requestCredentialOfferApproval) {
      return true;
    }
    return this.options.requestCredentialOfferApproval(
      buildOfferApprovalRequest(offer, metadata),
    );
  }

  private async requestPresentationApproval(
    definition: PresentationDefinition,
    match: CredentialSummary,
  ): Promise<boolean> {
    if (!this.options.requestCredentialPresentationApproval) {
      return true;
    }
    return this.options.requestCredentialPresentationApproval({
      verifierName: definition.verifier.name,
      verifierId: definition.verifier.id,
      requestedClaims: definition.requestedClaims,
      credentialType:
        match.type.find((t) => t !== CredentialTypeName("VerifiableCredential")) ??
        match.type[0] ??
        CredentialTypeName("Credential"),
      credentialIssuer: match.issuer,
    });
  }
}

function buildOfferApprovalRequest(
  offer: CredentialOffer,
  metadata: IssuerMetadata,
): CredentialOfferApprovalRequest {
  return {
    issuerName: formatIssuerName(offer.credentialIssuer),
    issuerId: offer.credentialIssuer,
    offeredCredentials: offer.credentialConfigurationIds.map((configurationId) => {
      const config = metadata.credentialConfigurationsSupported[configurationId];
      return {
        configurationId,
        format: config?.format ?? CredentialFormatId("sd-jwt-vc"),
        scope: config?.scope,
      };
    }),
  };
}

function formatIssuerName(issuer: CredentialOffer["credentialIssuer"]): string {
  try {
    return new URL(issuer).hostname;
  } catch {
    return issuer;
  }
}

import {
  CredentialFormatId,
  CredentialTypeName,
  HexString,
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
  /** Prefer over `hide` when nested host show / RPC should keep the panel open. */
  release?(): void;
};

export type CredentialsHelperWallet = {
  requestDisplay(
    params?: RequestDisplayParams,
  ): Promise<CredentialsHelperDisplaySession>;
  credentials: {
    register(handlers: OpenWalletCredentialProvider): void;
  };
};

/** Branding consent + issue (PoP / requestCredential / store). */
export type ApproveAndAcceptOfferRequest = CredentialOfferApprovalRequest & {
  offer: CredentialOffer;
  metadata: IssuerMetadata;
};

/** Branding consent + present (PoP / buildPresentation). */
export type ApproveAndPresentRequest = CredentialPresentationApprovalRequest & {
  definition: PresentationDefinition;
  match: CredentialSummary;
  credential: StoredCredential;
};

export type CredentialsHelperOptions = {
  repository: ICredentialRepository;
  oid4vci: IOid4vciClient;
  oid4vp: IOid4vpClient;
  trust: IIssuerTrustRegistry;
  status?: ICredentialStatusValidator;
  /**
   * Branding owns setup, consent UI, PoP, OID4 request, and vault store.
   * Helper opens display, then calls this; session is released afterward.
   */
  approveAndAcceptOffer: (
    request: ApproveAndAcceptOfferRequest,
  ) => Promise<CredentialReceipt>;
  /**
   * Branding owns setup (if needed), consent UI, PoP, and presentation build.
   * Helper opens display with a loaded credential, then calls this.
   */
  approveAndPresent: (
    request: ApproveAndPresentRequest,
  ) => Promise<PresentationResult>;
  /**
   * When true (default), re-check wallet trust on present after host
   * `acceptedIssuers` filtering.
   */
  recheckTrustOnPresent?: boolean;
};

/**
 * Thin OID4 adapter: resolve offer/request, trust/match/status, request display,
 * call branding `approveAnd*` handlers. Setup, consent, and PoP ceremonies belong
 * inside those branding callbacks — not on this helper (mirrors SignHelper).
 */
export class CredentialsHelper {
  readonly handlers: OpenWalletCredentialProvider;

  private readonly status: ICredentialStatusValidator;
  private readonly recheckTrustOnPresent: boolean;

  constructor(
    private readonly wallet: CredentialsHelperWallet,
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

    const approval = buildOfferApprovalRequest(offer, metadata);
    return this.withDisplay(() =>
      this.options.approveAndAcceptOffer({
        ...approval,
        offer,
        metadata,
      }),
    );
  }

  async present(input: PresentationRequestInput): Promise<PresentationResult> {
    const uri = input.requestUri;
    const definition =
      input.request ??
      (uri ? await this.options.oid4vp.resolveRequest(uri) : undefined);
    if (!definition) {
      throw new Error("requestUri or request is required");
    }

    const summaries = await this.options.repository.list();
    if (summaries.length === 0) {
      throw new Error(
        "No credentials in wallet (warm the local vault before present)",
      );
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
    const credential = await this.options.repository.get(match.credentialId);
    if (!credential) {
      throw new Error("Credential not found");
    }
    await this.assertActive(credential);

    const approval = buildPresentationApprovalRequest(definition, match);
    return this.withDisplay(() =>
      this.options.approveAndPresent({
        ...approval,
        definition,
        match,
        credential,
      }),
    );
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return this.options.repository.list(filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    await this.options.repository.delete(credentialId);
  }

  private async assertActive(credential: StoredCredential): Promise<void> {
    const check = await this.status.checkStatus(credential);
    if (check.status !== "active") {
      throw new Error(
        `Credential status is ${check.status}${check.details ? `: ${check.details}` : ""}`,
      );
    }
  }

  private async withDisplay<T>(run: () => Promise<T>): Promise<T> {
    const display = await this.wallet.requestDisplay({});
    try {
      return await run();
    } finally {
      // Prefer release over hide so host showWallet / in-flight RPC can keep
      // the flyout visible (same policy as SignHelper).
      if ("release" in display && typeof display.release === "function") {
        display.release();
      } else {
        await display.hide();
      }
    }
  }
}

/** Build the consent UI payload for a credential offer. */
export function buildOfferApprovalRequest(
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

/** Build the consent UI payload for a presentation request. */
export function buildPresentationApprovalRequest(
  definition: PresentationDefinition,
  match: CredentialSummary,
): CredentialPresentationApprovalRequest {
  return {
    verifierName: definition.verifier.name,
    verifierId: definition.verifier.id,
    requestedClaims: definition.requestedClaims,
    credentialType:
      match.type.find((t) => t !== CredentialTypeName("VerifiableCredential")) ??
      match.type[0] ??
      CredentialTypeName("Credential"),
    credentialIssuer: match.issuer,
  };
}

/**
 * Default OWS Ed25519 holder signer bridged to a Signing Layer instance.
 * Branding `approveAnd*` callbacks use this for PoP / KB JWT.
 */
export function createCredentialsHolderSigner(
  signer: IOWSSigner,
  holderSigner?: IHolderSigner | (() => Promise<IHolderSigner>),
): () => Promise<IHolderSigner> {
  return async () => {
    if (holderSigner) {
      return typeof holderSigner === "function"
        ? holderSigner()
        : holderSigner;
    }

    return CredentialCryptoUtils.createOwsEd25519HolderSigner({
      getEd25519PublicKeyHex: async () => {
        const cached = signer.getLastPublicKeyData();
        if (cached?.ed25519PublicKey) {
          return cached.ed25519PublicKey;
        }
        const keys = await signer.getPublicKey({
          credentialId: signer.getCredentialId(),
        });
        return keys.ed25519PublicKey;
      },
      signDigest: async (digests) => {
        const results = await signer.signDigest(
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
  };
}

/**
 * Issue a credential after branding consent: prepare nonce, PoP JWT,
 * requestCredential, assert status, store. Call from `approveAndAcceptOffer`.
 */
export async function issueCredentialAfterApproval(options: {
  offer: CredentialOffer;
  metadata: IssuerMetadata;
  oid4vci: IOid4vciClient;
  repository: ICredentialRepository;
  resolveHolderSigner: () => Promise<IHolderSigner>;
  getProofNonce?: (metadata: IssuerMetadata) => string | Promise<string>;
  attestationProvider?: IWalletAttestationProvider;
  status?: ICredentialStatusValidator;
}): Promise<CredentialReceipt> {
  const status = options.status ?? new NoopCredentialStatusValidator();
  const holderSigner = await options.resolveHolderSigner();
  const holderPublicKeyJwk = await holderSigner.publicKeyJwk();

  const prepared = options.oid4vci.prepareCredentialRequest
    ? await options.oid4vci.prepareCredentialRequest(
        options.offer,
        options.metadata,
      )
    : undefined;

  const nonce =
    prepared?.cNonce ??
    (options.getProofNonce
      ? await options.getProofNonce(options.metadata)
      : undefined);
  if (!nonce) {
    throw new Error(
      "OID4VCI C-nonce required (prepareCredentialRequest or getProofNonce)",
    );
  }

  const walletAttestationJwt = options.attestationProvider
    ? await options.attestationProvider.createAttestation({
        audience: options.metadata.credentialIssuer,
        nonce,
      })
    : undefined;

  const proofJwt = await ProofUtils.buildOid4vciProofJwt({
    holderSigner,
    audience: options.metadata.credentialIssuer,
    nonce,
  });
  const stored = await options.oid4vci.requestCredential(
    options.offer,
    options.metadata,
    {
      holderPublicKeyJwk,
      proof: { proof_type: "jwt", jwt: proofJwt },
      nonce,
      walletAttestationJwt,
    },
  );

  const check = await status.checkStatus(stored);
  if (check.status !== "active") {
    throw new Error(
      `Credential status is ${check.status}${check.details ? `: ${check.details}` : ""}`,
    );
  }
  await options.repository.store(stored);

  return {
    credentialId: stored.credentialId,
    format: stored.format,
    type: stored.type,
  };
}

/**
 * Build a presentation after branding consent. Call from `approveAndPresent`.
 */
export async function presentCredentialAfterApproval(options: {
  definition: PresentationDefinition;
  credential: StoredCredential;
  oid4vp: IOid4vpClient;
  resolveHolderSigner: () => Promise<IHolderSigner>;
  attestationProvider?: IWalletAttestationProvider;
}): Promise<PresentationResult> {
  const holderSigner = await options.resolveHolderSigner();
  const authorizationRequest = options.oid4vp.getAuthorizationRequest?.(
    options.definition.id,
  );
  return options.oid4vp.buildPresentation(
    options.credential,
    options.definition,
    {
      holderSigner,
      attestationProvider: options.attestationProvider,
      authorizationRequest,
    },
  );
}

function formatIssuerName(issuer: CredentialOffer["credentialIssuer"]): string {
  try {
    return new URL(issuer).hostname;
  } catch {
    return issuer;
  }
}

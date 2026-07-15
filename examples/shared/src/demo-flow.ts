import type {
  CredentialOfferInput,
  CredentialReceipt,
  PresentationRequestInput,
  PresentationResult,
  CredentialFilter,
  CredentialSummary,
  ICredentialRepository,
  IOid4vciClient,
  CredentialIssuanceContext,
  IOid4vpClient,
  PresentationBuildContext,
  ICredentialStatusValidator,
  KycProfilePolicy,
  IHolderSigner,
  IIssuerTrustRegistry,
  CredentialIssuer,
  CredentialId,
} from "@1shotapi/ows-types";
import {
  NoopCredentialStatusValidator,
  ProofUtils,
  PresentationUtils,
  type CredentialClaimName,
  type JWKThumbprint,
} from "@1shotapi/ows-types";
import { verifySdJwtVcPresentation } from "@1shotapi/ows-provider";
import type { SdJwtVcPayload } from "@sd-jwt/sd-jwt-vc";
import { MockOid4vciClient } from "./mock/oid4vci.js";
import { MockOid4vpClient } from "./mock/oid4vp.js";
import { InMemoryCredentialRepository } from "./in-memory-store.js";
import { InMemoryIssuerTrustRegistry } from "./in-memory-trust-registry.js";
import {
  MOCK_KYC_OFFER_URI,
  MOCK_KYC_PRESENTATION_URI,
  MOCK_KYC_PRESENTATION_REQUEST,
  MOCK_OID4VCI_PROOF_NONCE,
} from "./fixtures.js";
import { createDemoHolderSigner } from "./demo/jwk-holder-signer.js";
import { DEMO_ISSUER_PUBLIC_JWK } from "./demo/demo-keys.js";

export type DemoCredentialFlowDeps = {
  repository?: ICredentialRepository;
  oid4vci?: IOid4vciClient;
  oid4vp?: IOid4vpClient;
  status?: ICredentialStatusValidator;
  trust?: IIssuerTrustRegistry;
  approvePresentation?: () => Promise<boolean>;
  holderSigner?: IHolderSigner;
};

/** Orchestrates mock issuance → storage → presentation for tests and demos. */
export class DemoCredentialFlow {
  readonly repository: ICredentialRepository;
  readonly oid4vci: IOid4vciClient;
  readonly oid4vp: IOid4vpClient;
  readonly status: ICredentialStatusValidator;
  readonly trust: IIssuerTrustRegistry;
  private readonly approvePresentation: () => Promise<boolean>;
  private readonly holderSigner: IHolderSigner;

  constructor(deps: DemoCredentialFlowDeps = {}) {
    this.repository = deps.repository ?? new InMemoryCredentialRepository();
    this.oid4vci = deps.oid4vci ?? new MockOid4vciClient();
    this.oid4vp = deps.oid4vp ?? new MockOid4vpClient();
    this.status = deps.status ?? new NoopCredentialStatusValidator();
    this.trust = deps.trust ?? new InMemoryIssuerTrustRegistry();
    this.approvePresentation = deps.approvePresentation ?? (async () => true);
    this.holderSigner = deps.holderSigner ?? createDemoHolderSigner();
  }

  private async buildIssuanceContext(
    credentialIssuer: string,
  ): Promise<CredentialIssuanceContext> {
    const holderPublicKeyJwk = await this.holderSigner.publicKeyJwk();
    const nonce = MOCK_OID4VCI_PROOF_NONCE;
    const jwt = await ProofUtils.buildOid4vciProofJwt({
      holderSigner: this.holderSigner,
      audience: credentialIssuer,
      nonce,
    });
    return {
      holderPublicKeyJwk,
      proof: { proof_type: "jwt", jwt },
      nonce,
    };
  }

  private presentationContext(): PresentationBuildContext {
    return { holderSigner: this.holderSigner };
  }

  private async assertActive(
    credential: Awaited<ReturnType<ICredentialRepository["get"]>>,
  ): Promise<void> {
    if (!credential) {
      throw new Error("Credential not found");
    }
    const check = await this.status.checkStatus(credential);
    if (check.status !== "active") {
      throw new Error(
        `Credential status is ${check.status}${check.details ? `: ${check.details}` : ""}`,
      );
    }
  }

  async acceptOffer(
    input: CredentialOfferInput = {
      credentialOfferUri: MOCK_KYC_OFFER_URI,
    },
  ): Promise<CredentialReceipt> {
    const uri = input.credentialOfferUri;
    const offer =
      input.offer ??
      (uri ? await this.oid4vci.resolveOffer(uri) : undefined);
    if (!offer) {
      throw new Error("credentialOfferUri or offer is required");
    }

    const trusted = await this.trust.isTrustedIssuer(offer.credentialIssuer);
    if (!trusted) {
      throw new Error(`Untrusted issuer: ${offer.credentialIssuer}`);
    }

    const metadata = await this.oid4vci.fetchIssuerMetadata(
      offer.credentialIssuer,
    );
    const stored = await this.oid4vci.requestCredential(
      offer,
      metadata,
      await this.buildIssuanceContext(metadata.credentialIssuer),
    );
    await this.assertActive(stored);
    await this.repository.store(stored);

    return {
      credentialId: stored.credentialId,
      format: stored.format,
      type: stored.type,
    };
  }

  async present(
    input: PresentationRequestInput = {
      requestUri: MOCK_KYC_PRESENTATION_URI,
    },
  ): Promise<PresentationResult> {
    const uri = input.requestUri;
    const definition =
      input.request ??
      (uri ? await this.oid4vp.resolveRequest(uri) : undefined);
    if (!definition) {
      throw new Error("requestUri or request is required");
    }

    const summaries = await this.repository.list();
    let matches = await this.oid4vp.matchCredentials(definition, summaries);

    if (input.acceptedIssuers && input.acceptedIssuers.length > 0) {
      const allowed = new Set(input.acceptedIssuers);
      matches = matches.filter((m) => allowed.has(m.issuer));
    }

    if (matches.length === 0) {
      throw new Error("No matching credentials in wallet");
    }

    const approved = await this.approvePresentation();
    if (!approved) {
      throw new Error("User rejected presentation");
    }

    const credential = await this.repository.get(matches[0]!.credentialId);
    await this.assertActive(credential);

    return this.oid4vp.buildPresentation(
      credential!,
      definition,
      this.presentationContext(),
    );
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return this.repository.list(filter);
  }

  async delete(credentialId: CredentialId): Promise<void> {
    await this.repository.delete(credentialId);
  }
}

export type CustodyStepId =
  | "issuer_signature"
  | "issuer_allowed"
  | "required_claims"
  | "holder_cnf"
  | "kb_signature"
  | "kb_binding";

export type CustodyStep = {
  id: CustodyStepId;
  label: string;
  ok: boolean;
  detail: string;
};

export type MockVerifierResult = {
  valid: boolean;
  reasons: string[];
  /** Disclosed claim name → value (from crypto verify payload). */
  disclosedClaims: Record<string, unknown>;
  issuer?: string;
  vct?: string;
  format: string;
  holderJwk?: JsonWebKey;
  holderThumbprint?: JWKThumbprint;
  kb?: {
    nonce?: string;
    aud?: string;
    iat?: number;
  };
  custody: CustodyStep[];
};

function claimValuesFromPayload(
  payload: Record<string, unknown> | undefined,
  requested: CredentialClaimName[],
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!payload) return out;
  for (const name of requested) {
    if (name in payload) {
      out[name] = payload[name];
    }
  }
  return out;
}

/** MOCK verifier — policy + crypto + chain-of-custody inspection. */
export async function validateMockPresentation(
  presentation: PresentationResult,
  policy: KycProfilePolicy,
  issuerId: CredentialIssuer,
  holderPublicKeyJwk?: JsonWebKey,
  options?: {
    expectedNonce?: string;
    expectedAudience?: string;
    issuerPublicKeyJwk?: JsonWebKey;
  },
): Promise<MockVerifierResult> {
  const reasons: string[] = [];
  const expectedNonce =
    options?.expectedNonce ?? MOCK_KYC_PRESENTATION_REQUEST.nonce!;
  const expectedAudience =
    options?.expectedAudience ??
    MOCK_KYC_PRESENTATION_REQUEST.audience ??
    MOCK_KYC_PRESENTATION_REQUEST.verifier.id;
  const issuerPublicKeyJwk =
    options?.issuerPublicKeyJwk ?? DEMO_ISSUER_PUBLIC_JWK;

  const issuerClaims = PresentationUtils.decodeIssuerClaims(
    presentation.presentation,
  );
  const presentationIssuer = issuerClaims.iss ?? String(issuerId);
  const vct = issuerClaims.vct;

  const holderJwk =
    holderPublicKeyJwk ??
    PresentationUtils.extractHolderJwk(presentation.presentation) ??
    issuerClaims.cnf?.jwk;

  const kb = PresentationUtils.extractKbJwtClaims(presentation.presentation);
  const holderThumbprint = holderJwk
    ? await ProofUtils.jwkThumbprint(holderJwk)
    : undefined;

  const missingClaims = policy.requiredClaims.filter(
    (claim) => !presentation.disclosedClaims.includes(claim),
  );
  const issuerAllowed = policy.allowedIssuers.some(
    (allowed) => allowed === presentationIssuer || allowed === issuerId,
  );

  for (const claim of missingClaims) {
    reasons.push(`Missing required claim: ${claim}`);
  }
  if (!issuerAllowed) {
    reasons.push(`Issuer not in allowed list: ${presentationIssuer}`);
  }
  if (!holderJwk) {
    reasons.push("Missing holder cnf.jwk in SD-JWT VC presentation");
  }

  let cryptoValid = false;
  let cryptoReasons: string[] = [];
  let payload: SdJwtVcPayload | undefined;

  if (holderJwk) {
    const cryptoResult = await verifySdJwtVcPresentation({
      presentation: presentation.presentation,
      issuerPublicKeyJwk,
      holderPublicKeyJwk: holderJwk,
      nonce: expectedNonce,
      audience: expectedAudience,
    });
    cryptoValid = cryptoResult.valid;
    cryptoReasons = cryptoResult.reasons;
    payload = cryptoResult.payload;
    if (!cryptoValid) {
      reasons.push(...cryptoReasons);
    }
  }

  const disclosedClaims = claimValuesFromPayload(
    payload,
    policy.requiredClaims,
  );
  for (const name of presentation.disclosedClaims) {
    if (!(name in disclosedClaims) && payload && name in payload) {
      disclosedClaims[name] = payload[name];
    }
  }

  const kbBindingOk =
    kb?.nonce === expectedNonce && kb?.aud === expectedAudience;

  const custody: CustodyStep[] = [
    {
      id: "issuer_signature",
      label: "Issuer signed SD-JWT VC",
      ok: cryptoValid,
      detail: cryptoValid
        ? `Verified with demo issuer key (${presentationIssuer})`
        : (cryptoReasons.find((r) => !/audience|nonce/i.test(r)) ??
          (holderJwk
            ? "Issuer or presentation signature failed"
            : "Skipped — no holder key")),
    },
    {
      id: "issuer_allowed",
      label: "Issuer allowed by policy",
      ok: issuerAllowed,
      detail: issuerAllowed
        ? `${presentationIssuer} is on the allow list`
        : `${presentationIssuer} is not allowed`,
    },
    {
      id: "required_claims",
      label: "Required claims disclosed",
      ok: missingClaims.length === 0,
      detail:
        missingClaims.length === 0
          ? policy.requiredClaims.join(", ")
          : `Missing: ${missingClaims.join(", ")}`,
    },
    {
      id: "holder_cnf",
      label: "Holder bound via cnf.jwk",
      ok: Boolean(holderJwk),
      detail: holderThumbprint
        ? `thumbprint ${holderThumbprint}`
        : "No cnf.jwk in credential",
    },
    {
      id: "kb_signature",
      label: "kb+jwt verifies under cnf.jwk",
      ok: cryptoValid,
      detail: cryptoValid
        ? "Key-binding signature valid"
        : (cryptoReasons.find((r) => /kb|key.?binding|signature/i.test(r)) ??
          "Key-binding verification failed"),
    },
    {
      id: "kb_binding",
      label: "kb+jwt nonce and audience match request",
      ok: kbBindingOk,
      detail: kb
        ? `nonce=${kb.nonce ?? "—"} aud=${kb.aud ?? "—"} (expected nonce=${expectedNonce} aud=${expectedAudience})`
        : "Missing kb+jwt",
    },
  ];

  return {
    valid: reasons.length === 0 && custody.every((step) => step.ok),
    reasons,
    disclosedClaims,
    issuer: presentationIssuer,
    vct,
    format: presentation.format,
    holderJwk,
    holderThumbprint,
    kb: kb
      ? { nonce: kb.nonce, aud: kb.aud, iat: kb.iat }
      : undefined,
    custody,
  };
}

import type {
  CredentialOfferInput,
  CredentialReceipt,
  PresentationRequestInput,
  PresentationResult,
  CredentialFilter,
  CredentialSummary,
  CredentialStore,
  Oid4vciClient,
  CredentialIssuanceContext,
  Oid4vpClient,
  PresentationBuildContext,
  CredentialStatusValidator,
  KycProfilePolicy,
  HolderSigner,
  IssuerTrustRegistry,
  CredentialIssuer,
} from "@1shotapi/ows-types";
import {
  CredentialOfferUri,
  PresentationRequestUri,
  UriString,
  NoopCredentialStatusValidator,
} from "@1shotapi/ows-types";
import { verifySdJwtVcPresentation } from "@1shotapi/ows-provider";
import { extractHolderJwkFromSdJwtVc } from "@1shotapi/ows-types";
import { MockOid4vciClient } from "./mock/oid4vci.js";
import { MockOid4vpClient } from "./mock/oid4vp.js";
import { InMemoryCredentialStore } from "./in-memory-store.js";
import { InMemoryIssuerTrustRegistry } from "./in-memory-trust-registry.js";
import {
  MOCK_KYC_OFFER_URI,
  MOCK_KYC_PRESENTATION_URI,
  MOCK_KYC_PRESENTATION_REQUEST,
} from "./fixtures.js";
import { createDemoHolderSigner } from "./demo/jwk-holder-signer.js";
import { DEMO_ISSUER_PUBLIC_JWK } from "./demo/demo-keys.js";

export type DemoCredentialFlowDeps = {
  store?: CredentialStore;
  oid4vci?: Oid4vciClient;
  oid4vp?: Oid4vpClient;
  status?: CredentialStatusValidator;
  trust?: IssuerTrustRegistry;
  approvePresentation?: () => Promise<boolean>;
  holderSigner?: HolderSigner;
};

/** Orchestrates mock issuance → storage → presentation for tests and demos. */
export class DemoCredentialFlow {
  readonly store: CredentialStore;
  readonly oid4vci: Oid4vciClient;
  readonly oid4vp: Oid4vpClient;
  readonly status: CredentialStatusValidator;
  readonly trust: IssuerTrustRegistry;
  private readonly approvePresentation: () => Promise<boolean>;
  private readonly holderSigner: HolderSigner;

  constructor(deps: DemoCredentialFlowDeps = {}) {
    this.store = deps.store ?? new InMemoryCredentialStore();
    this.oid4vci = deps.oid4vci ?? new MockOid4vciClient();
    this.oid4vp = deps.oid4vp ?? new MockOid4vpClient();
    this.status = deps.status ?? new NoopCredentialStatusValidator();
    this.trust = deps.trust ?? new InMemoryIssuerTrustRegistry();
    this.approvePresentation = deps.approvePresentation ?? (async () => true);
    this.holderSigner = deps.holderSigner ?? createDemoHolderSigner();
  }

  private async buildIssuanceContext(): Promise<CredentialIssuanceContext> {
    return {
      holderPublicKeyJwk: await this.holderSigner.publicKeyJwk(),
    };
  }

  private presentationContext(): PresentationBuildContext {
    return { holderSigner: this.holderSigner };
  }

  async acceptOffer(
    input: CredentialOfferInput = {
      credentialOfferUri: CredentialOfferUri(MOCK_KYC_OFFER_URI),
    },
  ): Promise<CredentialReceipt> {
    const uri = input.credentialOfferUri;
    const offer =
      input.offer ??
      (uri ? await this.oid4vci.resolveOffer(UriString(uri)) : undefined);
    if (!offer) {
      throw new Error("credentialOfferUri or offer is required");
    }

    const metadata = await this.oid4vci.fetchIssuerMetadata(
      offer.credentialIssuer,
    );
    const stored = await this.oid4vci.requestCredential(
      offer,
      metadata,
      await this.buildIssuanceContext(),
    );
    await this.status.checkStatus(stored);
    await this.store.save(stored);

    return {
      credentialId: stored.credentialId,
      format: stored.format,
      type: stored.type,
    };
  }

  async present(
    input: PresentationRequestInput = {
      requestUri: PresentationRequestUri(MOCK_KYC_PRESENTATION_URI),
    },
  ): Promise<PresentationResult> {
    const uri = input.requestUri;
    const definition =
      input.request ??
      (uri ? await this.oid4vp.resolveRequest(UriString(uri)) : undefined);
    if (!definition) {
      throw new Error("requestUri or request is required");
    }

    const summaries = await this.store.list();
    const matches = await this.oid4vp.matchCredentials(definition, summaries);
    if (matches.length === 0) {
      throw new Error("No matching credentials in wallet");
    }

    const approved = await this.approvePresentation();
    if (!approved) {
      throw new Error("User rejected presentation");
    }

    const credential = await this.store.get(matches[0]!.credentialId);
    if (!credential) {
      throw new Error("Credential not found");
    }

    return this.oid4vp.buildPresentation(
      credential,
      definition,
      this.presentationContext(),
    );
  }

  async list(filter?: CredentialFilter): Promise<CredentialSummary[]> {
    return this.store.list(filter);
  }

  async delete(credentialId: Parameters<CredentialStore["delete"]>[0]): Promise<void> {
    await this.store.delete(credentialId);
  }
}

export type MockVerifierResult = {
  valid: boolean;
  reasons: string[];
};

/** MOCK verifier — checks presentation against KycProfilePolicy and SD-JWT VC crypto. */
export async function validateMockPresentation(
  presentation: PresentationResult,
  policy: KycProfilePolicy,
  issuerId: CredentialIssuer,
  holderPublicKeyJwk?: JsonWebKey,
): Promise<MockVerifierResult> {
  const reasons: string[] = [];

  if (!policy.allowedIssuers.includes(issuerId)) {
    reasons.push(`Issuer not in allowed list: ${issuerId}`);
  }

  for (const claim of policy.requiredClaims) {
    if (!presentation.disclosedClaims.includes(claim)) {
      reasons.push(`Missing required claim: ${claim}`);
    }
  }

  const holderJwk =
    holderPublicKeyJwk ??
    extractHolderJwkFromSdJwtVc(presentation.presentation);
  if (!holderJwk) {
    reasons.push("Missing holder cnf.jwk in SD-JWT VC presentation");
    return { valid: false, reasons };
  }

  const cryptoResult = await verifySdJwtVcPresentation({
    presentation: presentation.presentation,
    issuerPublicKeyJwk: DEMO_ISSUER_PUBLIC_JWK,
    holderPublicKeyJwk: holderJwk,
    nonce: MOCK_KYC_PRESENTATION_REQUEST.nonce!,
    audience:
      MOCK_KYC_PRESENTATION_REQUEST.audience ??
      MOCK_KYC_PRESENTATION_REQUEST.verifier.id,
  });

  if (!cryptoResult.valid) {
    reasons.push(...cryptoResult.reasons);
  }

  return { valid: reasons.length === 0, reasons };
}

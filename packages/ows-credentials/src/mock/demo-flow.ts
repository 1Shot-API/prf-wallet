import type { CredentialOfferInput, CredentialReceipt } from "../types/offer.js";
import type {
  PresentationRequestInput,
  PresentationResult,
} from "../types/presentation.js";
import type { CredentialFilter, CredentialSummary } from "../types/filter.js";
import type { CredentialStore } from "../storage.js";
import type { Oid4vciClient, CredentialIssuanceContext } from "../oid4vci/client.js";
import type { Oid4vpClient, PresentationBuildContext } from "../oid4vp/client.js";
import type { CredentialStatusValidator } from "../status/validator.js";
import type { KycProfilePolicy } from "../types/kyc-profile.js";
import type { HolderSigner } from "../sd-jwt-vc/holder-signer.js";
import {
  CredentialIssuer,
  CredentialOfferUri,
  PresentationRequestUri,
  UriString,
} from "@1shotapi/ows-types";
import { MockOid4vciClient } from "../oid4vci/mock.js";
import { MockOid4vpClient } from "../oid4vp/mock.js";
import { InMemoryCredentialStore } from "./in-memory-store.js";
import { NoopCredentialStatusValidator } from "../status/validator.js";
import { InMemoryIssuerTrustRegistry } from "../trust/in-memory-registry.js";
import {
  MOCK_KYC_OFFER_URI,
  MOCK_KYC_PRESENTATION_URI,
  MOCK_KYC_PRESENTATION_REQUEST,
} from "./fixtures.js";
import type { IssuerTrustRegistry } from "../trust/registry.js";
import { verifySdJwtVcPresentation } from "../sd-jwt-vc/verify.js";
import { createDemoHolderSigner } from "../sd-jwt-vc/jwk-holder-signer.js";
import { extractHolderJwkFromSdJwtVc } from "../sd-jwt-vc/decode.js";

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

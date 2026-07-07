import type { UriString } from "@1shotapi/ows-types";
import type { Oid4vpClient } from "./client.js";
import type { StoredCredential } from "../types/credential.js";
import type {
  PresentationDefinition,
  PresentationResult,
} from "../types/presentation.js";
import type { CredentialSummary } from "../types/filter.js";
import {
  MOCK_KYC_PRESENTATION_REQUEST,
  MOCK_KYC_PRESENTATION_URI,
  MOCK_PRESENTATION_PAYLOAD,
} from "../mock/fixtures.js";

/** MOCK OID4VP client — resolves mock:// URIs to fixtures only. */
export class MockOid4vpClient implements Oid4vpClient {
  async resolveRequest(uri: UriString): Promise<PresentationDefinition> {
    if (
      uri === MOCK_KYC_PRESENTATION_URI ||
      uri.startsWith("mock://kyc-presentation")
    ) {
      return { ...MOCK_KYC_PRESENTATION_REQUEST };
    }
    throw new Error(`MockOid4vpClient: unknown request URI: ${uri}`);
  }

  async matchCredentials(
    definition: PresentationDefinition,
    credentials: CredentialSummary[],
  ): Promise<CredentialSummary[]> {
    const types = definition.credentialTypes ?? [];
    return credentials.filter((c) => {
      if (types.length === 0) {
        return true;
      }
      return types.some((t) => c.type.includes(t));
    });
  }

  async buildPresentation(
    credential: StoredCredential,
    definition: PresentationDefinition,
  ): Promise<PresentationResult> {
    const disclosedClaims = definition.requestedClaims.filter((claim) => {
      const subject = credential.semantic.credentialSubject;
      return claim in subject;
    });

    return {
      presentation: MOCK_PRESENTATION_PAYLOAD,
      format: credential.format,
      disclosedClaims,
    };
  }
}

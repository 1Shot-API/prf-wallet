import type {
  IOid4vpClient,
  PresentationBuildContext,
  PresentationRequestUri,
  StoredCredential,
  PresentationDefinition,
  PresentationResult,
  CredentialSummary,
} from "@1shotapi/ows-types";
import { buildSdJwtVcPresentation } from "@1shotapi/ows-types";
import {
  MOCK_KYC_PRESENTATION_REQUEST,
  MOCK_KYC_PRESENTATION_URI,
} from "../fixtures.js";
import { createDemoHolderSigner } from "../demo/jwk-holder-signer.js";

/** MOCK OID4VP client — resolves mock:// URIs and builds real SD-JWT VC presentations. */
export class MockOid4vpClient implements IOid4vpClient {
  async resolveRequest(uri: PresentationRequestUri): Promise<PresentationDefinition> {
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
    context?: PresentationBuildContext,
  ): Promise<PresentationResult> {
    const holderSigner = context?.holderSigner ?? createDemoHolderSigner();

    if (credential.format === "sd-jwt-vc") {
      const built = await buildSdJwtVcPresentation({
        credential,
        definition,
        holderSigner,
      });
      return {
        presentation: built.presentation,
        format: credential.format,
        disclosedClaims: built.disclosedClaims,
      };
    }

    throw new Error(
      `MockOid4vpClient: unsupported credential format ${credential.format}`,
    );
  }
}

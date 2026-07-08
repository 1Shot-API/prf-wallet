import {
  MOCK_KYC_PRESENTATION_URI,
  validateMockPresentation as validatePresentation,
} from "@1shotapi/ows-credentials/mock";
import type { KycProfilePolicy, PresentationResult } from "@1shotapi/ows-credentials";
import type { CredentialIssuer } from "@1shotapi/ows-types";

export function getMockVerifierRequestUri(): string {
  return MOCK_KYC_PRESENTATION_URI;
}

export function validateMockPresentation(
  presentation: PresentationResult,
  policy: KycProfilePolicy,
  issuerId: CredentialIssuer,
) {
  return validatePresentation(presentation, policy, issuerId);
}

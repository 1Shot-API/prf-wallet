import type {
  CredentialClaimName,
  CredentialIssuer,
  CredentialTypeName,
  PresentationRequestUri,
  SdJwtVcPresentationString,
  UriString,
} from "@1shotapi/ows-types";
import type { CredentialFormat } from "./format.js";

export type PresentationDefinition = {
  id: string;
  verifier: {
    id: UriString;
    name: string;
  };
  requestedClaims: CredentialClaimName[];
  credentialTypes?: CredentialTypeName[];
  nonce?: string;
  audience?: string;
};

export type PresentationRequestInput = {
  requestUri?: PresentationRequestUri;
  request?: PresentationDefinition;
};

export type PresentationResult = {
  presentation: SdJwtVcPresentationString;
  format: CredentialFormat;
  disclosedClaims: CredentialClaimName[];
};

export type CredentialPresentationApprovalRequest = {
  verifierName: string;
  verifierId: UriString;
  requestedClaims: CredentialClaimName[];
  credentialType: CredentialTypeName;
  credentialIssuer: CredentialIssuer;
};

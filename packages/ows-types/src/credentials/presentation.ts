import type {
  CredentialClaimName,
  CredentialIssuer,
  CredentialTypeName,
  PresentationRequestUri,
  SdJwtVcPresentationString,
  UriString,
} from "../primitives/index.js";
import type { CredentialFormat } from "./format.js";
import type { OwsDcqlQuery } from "./dcql.js";

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

/**
 * Transport / protocol fields from an OID4VP authorization request
 * (fetched via `request_uri` or embedded). Wallet-facing claim selection
 * still uses {@link PresentationDefinition}.
 */
export type Oid4vpResponseMode = "direct_post" | "direct_post.jwt" | "fragment";

export type Oid4vpClientMetadata = {
  /** JWKS for encrypting the presentation response (direct_post.jwt). */
  jwks?: {
    keys: JsonWebKey[];
  };
  jwks_uri?: string;
  authorization_encrypted_response_alg?: string;
  authorization_encrypted_response_enc?: string;
  /** When true, wallet should attach a wallet attestation JWT. */
  require_wallet_attestation?: boolean;
  client_name?: string;
};

export type Oid4vpAuthorizationRequest = {
  clientId: string;
  nonce?: string;
  responseUri?: UriString;
  responseMode?: Oid4vpResponseMode;
  clientMetadata?: Oid4vpClientMetadata;
  /** Raw DCQL query when the verifier uses DCQL instead of a claim-list PD. */
  dcqlQuery?: OwsDcqlQuery;
  /** Mapped wallet-facing definition (always populated after resolve). */
  presentationDefinition: PresentationDefinition;
};

export type PresentationRequestInput = {
  requestUri?: PresentationRequestUri;
  request?: PresentationDefinition;
  /** Host/verifier allow-list; wallet intersects with matched credentials. */
  acceptedIssuers?: CredentialIssuer[];
};

export type PresentationResult = {
  presentation: SdJwtVcPresentationString;
  format: CredentialFormat;
  disclosedClaims: CredentialClaimName[];
  /** When the VP was encrypted for `direct_post.jwt`. */
  encryptedResponse?: string;
  responseMode?: Oid4vpResponseMode;
  /** True when the client already POSTed to `response_uri`. */
  submittedToResponseUri?: boolean;
};

export type CredentialPresentationApprovalRequest = {
  verifierName: string;
  verifierId: UriString;
  requestedClaims: CredentialClaimName[];
  credentialType: CredentialTypeName;
  credentialIssuer: CredentialIssuer;
};

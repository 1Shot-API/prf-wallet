import type { CredentialIssuer } from "../primitives/index.js";
import type { IssuerTrustMetadata } from "./trust.js";

/**
 * Branding-owned issuer trust. Confirms whether the wallet will store/use credentials
 * from an already-identified issuer — not cryptographic issuer identity verification.
 */
export interface IIssuerTrustRegistry {
  isTrustedIssuer(issuerId: CredentialIssuer): Promise<boolean>;
  resolveIssuer(issuerId: CredentialIssuer): Promise<IssuerTrustMetadata | undefined>;
  listIssuers(): Promise<IssuerTrustMetadata[]>;
}

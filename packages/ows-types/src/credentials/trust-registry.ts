import type { CredentialIssuer } from "../primitives/index.js";
import type { IssuerTrustMetadata } from "./trust.js";

export interface IssuerTrustRegistry {
  resolveIssuer(issuerId: CredentialIssuer): Promise<IssuerTrustMetadata | undefined>;
  listIssuers(): Promise<IssuerTrustMetadata[]>;
}

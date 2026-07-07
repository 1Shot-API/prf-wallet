import type { CredentialIssuer } from "@1shotapi/ows-types";
import type { IssuerTrustMetadata } from "../types/trust.js";

export interface IssuerTrustRegistry {
  resolveIssuer(issuerId: CredentialIssuer): Promise<IssuerTrustMetadata | undefined>;
  listIssuers(): Promise<IssuerTrustMetadata[]>;
}

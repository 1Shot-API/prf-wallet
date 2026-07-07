import type { CredentialIssuer } from "@1shotapi/ows-types";

export type AssuranceLevel = "low" | "substantial" | "high";

export type IssuerTrustMetadata = {
  issuerId: CredentialIssuer;
  name: string;
  assuranceLevels: AssuranceLevel[];
  jurisdictions?: string[];
};

export type TrustRegistryEntry = IssuerTrustMetadata;

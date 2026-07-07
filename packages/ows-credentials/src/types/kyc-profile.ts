import type { CredentialClaimName, CredentialIssuer } from "@1shotapi/ows-types";
import type { AssuranceLevel } from "./trust.js";

export type KycProfilePolicy = {
  requiredClaims: CredentialClaimName[];
  minAssuranceLevel: AssuranceLevel;
  maxAgeDays: number;
  allowedIssuers: CredentialIssuer[];
};

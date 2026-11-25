import type { CredentialClaimName, CredentialIssuer } from "../primitives/index.js";
import type { AssuranceLevel } from "./trust.js";

export type KycProfilePolicy = {
  requiredClaims: CredentialClaimName[];
  minAssuranceLevel: AssuranceLevel;
  maxAgeDays: number;
  allowedIssuers: CredentialIssuer[];
};

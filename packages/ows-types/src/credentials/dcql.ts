import type { CredentialClaimName } from "../primitives/CredentialClaimName.js";
import type { CredentialTypeName } from "../primitives/CredentialTypeName.js";

/**
 * Supported DCQL subset for OWS Phase 4 (fail closed on unsupported shapes).
 * Maps to {@link import("./presentation.js").PresentationDefinition} claim lists.
 */
export type OwsDcqlClaimQuery = {
  path: string[];
};

export type OwsDcqlCredentialQuery = {
  id: string;
  format: string;
  meta?: {
    vct_values?: string[];
  };
  claims?: OwsDcqlClaimQuery[];
};

export type OwsDcqlQuery = {
  credentials: OwsDcqlCredentialQuery[];
};

export type DcqlMapResult = {
  requestedClaims: CredentialClaimName[];
  credentialTypes: CredentialTypeName[];
};

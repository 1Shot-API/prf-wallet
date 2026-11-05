import {
  CredentialClaimName,
  CredentialTypeName,
  type DcqlMapResult,
  type OwsDcqlQuery,
} from "@1shotapi/ows-types";

/**
 * Map a supported DCQL subset into OWS claim-list presentation fields.
 * Fails closed on multi-credential queries or unsupported formats.
 */
export function mapDcqlToPresentationFields(query: OwsDcqlQuery): DcqlMapResult {
  if (!query.credentials || query.credentials.length === 0) {
    throw new Error("DCQL: credentials array is required");
  }
  if (query.credentials.length > 1) {
    throw new Error("DCQL: multi-credential queries are not supported in Phase 4");
  }

  const cred = query.credentials[0]!;
  if (cred.format !== "vc+sd-jwt" && cred.format !== "dc+sd-jwt") {
    throw new Error(
      `DCQL: unsupported format ${cred.format} (expected vc+sd-jwt or dc+sd-jwt)`,
    );
  }

  const credentialTypes = (cred.meta?.vct_values ?? []).map((v) =>
    CredentialTypeName(v),
  );

  const requestedClaims: CredentialClaimName[] = [];
  for (const claim of cred.claims ?? []) {
    if (!claim.path || claim.path.length === 0) {
      throw new Error("DCQL: claim path must be non-empty");
    }
    if (claim.path.length > 1) {
      throw new Error(
        "DCQL: nested claim paths are not supported (use single claim name)",
      );
    }
    const name = claim.path[0]!;
    if (typeof name !== "string") {
      throw new Error("DCQL: claim path segment must be a string");
    }
    requestedClaims.push(CredentialClaimName(name));
  }

  if (requestedClaims.length === 0) {
    throw new Error("DCQL: at least one claim is required");
  }

  return { requestedClaims, credentialTypes };
}

import {
  ConversionUtils,
  CredentialId,
  CredentialIssuer,
  CredentialTypeName,
  ISO8601DateTime,
  UriString,
  PresentationUtils,
  type StoredCredential,
} from "@1shotapi/ows-types";

/** Peek at the issuer-signed JWT payload inside an SD-JWT VC (no verify). */
export function peekSdJwtVcPayload(sdJwt: string): Record<string, unknown> {
  const issuerSigned = sdJwt.split("~")[0] ?? sdJwt;
  const parts = issuerSigned.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid SD-JWT VC");
  }
  return ConversionUtils.decodeJsonBase64Url<Record<string, unknown>>(
    parts[1]!,
  );
}

/**
 * Map an OID4VCI credential endpoint SD-JWT into {@link StoredCredential}.
 *
 * Subject claims include selectively disclosed fields unpacked from `~` segments.
 */
export async function storedCredentialFromSdJwtVc(input: {
  sdJwt: string;
  fallbackIssuer: CredentialIssuer;
}): Promise<StoredCredential> {
  const payload = peekSdJwtVcPayload(input.sdJwt);
  const iss =
    typeof payload.iss === "string"
      ? CredentialIssuer(payload.iss)
      : input.fallbackIssuer;
  const vct = typeof payload.vct === "string" ? payload.vct : "Credential";
  const iat =
    typeof payload.iat === "number"
      ? ISO8601DateTime(new Date(payload.iat * 1000).toISOString())
      : ISO8601DateTime(new Date().toISOString());
  const exp =
    typeof payload.exp === "number"
      ? ISO8601DateTime(new Date(payload.exp * 1000).toISOString())
      : undefined;

  const subject = await PresentationUtils.unpackSubject(input.sdJwt);

  const type = [
    CredentialTypeName("VerifiableCredential"),
    CredentialTypeName(vct),
  ];

  return {
    credentialId: CredentialId(`cred_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`),
    format: "sd-jwt-vc",
    type,
    issuer: iss,
    issuedAt: iat,
    validUntil: exp,
    payload: input.sdJwt,
    semantic: {
      type,
      issuer: iss,
      validFrom: iat,
      validUntil: exp,
      credentialSubject: subject,
      credentialSchema: {
        id: UriString(`https://schemas.ows.example/${vct}/v1`),
        type: "JsonSchema",
      },
    },
  };
}

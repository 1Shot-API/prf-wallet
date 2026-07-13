import { decodeJwt, splitSdJwt } from "@sd-jwt/core";
import type { SdJwtVcPresentationString } from "../../../primitives/SdJwtVcPresentationString.js";

export type SdJwtVcIssuerClaims = {
  iss?: string;
  vct?: string;
  iat?: number;
  cnf?: { jwk?: JsonWebKey };
};

export type KbJwtClaims = {
  iat?: number;
  aud?: string;
  nonce?: string;
  sd_hash?: string;
};

/** Reads `cnf.jwk` from an SD-JWT VC (presentation or full credential). */
export function extractHolderJwkFromSdJwtVc(
  encoded: SdJwtVcPresentationString,
): JsonWebKey | undefined {
  return decodeSdJwtVcIssuerClaims(encoded).cnf?.jwk;
}

/** Decodes issuer JWT payload claims from an SD-JWT VC compact string. */
export function decodeSdJwtVcIssuerClaims(
  encoded: SdJwtVcPresentationString,
): SdJwtVcIssuerClaims {
  const { jwt } = splitSdJwt(encoded);
  const { payload } = decodeJwt<Record<string, unknown>, SdJwtVcIssuerClaims>(jwt);
  return payload;
}

/**
 * Decodes the key-binding JWT (`kb+jwt`) claims from a presentation.
 * Returns `undefined` when no kb segment is present.
 */
export function extractKbJwtClaims(
  encoded: SdJwtVcPresentationString,
): KbJwtClaims | undefined {
  const parts = encoded.split("~");
  const kb = parts[parts.length - 1];
  if (!kb || !kb.includes(".")) {
    return undefined;
  }
  try {
    const { payload } = decodeJwt<Record<string, unknown>, KbJwtClaims>(kb);
    return payload;
  } catch {
    return undefined;
  }
}

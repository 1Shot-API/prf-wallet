import { decodeJwt, splitSdJwt } from "@sd-jwt/core";
import type { SdJwtVcPresentationString } from "../../../primitives/SdJwtVcPresentationString.js";

/** Reads `cnf.jwk` from an SD-JWT VC (presentation or full credential). */
export function extractHolderJwkFromSdJwtVc(
  encoded: SdJwtVcPresentationString,
): JsonWebKey | undefined {
  const { jwt } = splitSdJwt(encoded);
  const { payload } = decodeJwt<Record<string, unknown>, Record<string, unknown>>(jwt);
  const cnf = payload.cnf as { jwk?: JsonWebKey } | undefined;
  return cnf?.jwk;
}

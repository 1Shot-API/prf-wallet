import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import type { VerifierOptions } from "@sd-jwt/core";
import type { SdJwtVcPresentationString } from "@1shotapi/ows-types";
import {
  createEd25519VerifierFromJwk,
  sdJwtHasher,
} from "@1shotapi/ows-types";

export type VerifySdJwtVcPresentationInput = {
  presentation: SdJwtVcPresentationString;
  issuerPublicKeyJwk: JsonWebKey;
  holderPublicKeyJwk: JsonWebKey;
  nonce: string;
  audience: string;
  options?: VerifierOptions;
};

export type VerifySdJwtVcPresentationResult = {
  valid: boolean;
  reasons: string[];
  payload?: Record<string, unknown>;
};

/** Cryptographically verifies an SD-JWT VC presentation (issuer sig + kb+jwt). */
export async function verifySdJwtVcPresentation(
  input: VerifySdJwtVcPresentationInput,
): Promise<VerifySdJwtVcPresentationResult> {
  const issuerVerifier = createEd25519VerifierFromJwk(input.issuerPublicKeyJwk);
  const holderVerifier = createEd25519VerifierFromJwk(input.holderPublicKeyJwk);

  const sdjwt = new SDJwtVcInstance({
    verifier: issuerVerifier,
    kbVerifier: holderVerifier,
    hasher: sdJwtHasher,
    hashAlg: "sha-256",
  });

  const result = await sdjwt.safeVerify(input.presentation, {
    keyBindingNonce: input.nonce,
    ...input.options,
  });

  if (result.success) {
    return {
      valid: true,
      reasons: [],
      payload: result.data.payload as Record<string, unknown>,
    };
  }

  return {
    valid: false,
    reasons: result.errors.map((e) => e.message),
  };
}

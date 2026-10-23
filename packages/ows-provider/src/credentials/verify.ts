import { SDJwtVcInstance, type SdJwtVcPayload } from "@sd-jwt/sd-jwt-vc";
import type { VerifierOptions } from "@sd-jwt/core";
import {
  CredentialCryptoUtils,
  PresentationUtils,
  type SdJwtVcPresentationString,
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
  payload?: SdJwtVcPayload;
};

/** Cryptographically verifies an SD-JWT VC presentation (issuer sig + kb+jwt). */
export async function verifySdJwtVcPresentation(
  input: VerifySdJwtVcPresentationInput,
): Promise<VerifySdJwtVcPresentationResult> {
  const issuerVerifier = CredentialCryptoUtils.createEd25519Verifier(
    input.issuerPublicKeyJwk,
  );
  const holderVerifier = CredentialCryptoUtils.createEd25519Verifier(
    input.holderPublicKeyJwk,
  );

  const sdjwt = new SDJwtVcInstance({
    verifier: issuerVerifier,
    kbVerifier: holderVerifier,
    hasher: CredentialCryptoUtils.hasher,
    hashAlg: "sha-256",
  });

  const result = await sdjwt.safeVerify(input.presentation, {
    keyBindingNonce: input.nonce,
    ...input.options,
  });

  const reasons: string[] = [];
  if (!result.success) {
    reasons.push(...result.errors.map((e) => e.message));
  }

  // @sd-jwt only checks keyBindingNonce — enforce audience from kb+jwt claims.
  const kb = PresentationUtils.extractKbJwtClaims(input.presentation);
  if (!kb) {
    reasons.push("Missing kb+jwt in presentation");
  } else {
    if (kb.aud !== input.audience) {
      reasons.push(
        `kb+jwt audience mismatch: expected ${input.audience}, got ${kb.aud ?? "(missing)"}`,
      );
    }
    if (kb.nonce !== input.nonce) {
      reasons.push(
        `kb+jwt nonce mismatch: expected ${input.nonce}, got ${kb.nonce ?? "(missing)"}`,
      );
    }
  }

  if (reasons.length > 0) {
    return { valid: false, reasons };
  }

  return {
    valid: true,
    reasons: [],
    payload: result.success ? result.data.payload : undefined,
  };
}

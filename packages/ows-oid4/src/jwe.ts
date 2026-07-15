import * as jose from "jose";

const DEFAULT_ALG = "ECDH-ES";
const DEFAULT_ENC = "A256GCM";

/**
 * Encrypt a presentation string as a JWE Compact Serialization for
 * `direct_post.jwt` using the verifier's encryption JWK.
 */
export async function encryptPresentationResponse(
  plaintext: string,
  recipientJwk: JsonWebKey,
  options?: {
    alg?: string;
    enc?: string;
  },
): Promise<string> {
  const alg = options?.alg ?? DEFAULT_ALG;
  const enc = options?.enc ?? DEFAULT_ENC;
  const key = await jose.importJWK(recipientJwk, alg);
  return new jose.CompactEncrypt(new TextEncoder().encode(plaintext))
    .setProtectedHeader({ alg, enc, cty: "JWT" })
    .encrypt(key);
}

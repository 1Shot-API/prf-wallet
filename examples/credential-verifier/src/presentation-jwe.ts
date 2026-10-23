import * as jose from "jose";

const DEFAULT_ALG = "ECDH-ES";

/** Decrypt a compact JWE VP response (`direct_post.jwt`). */
export async function decryptPresentationResponse(
  jwe: string,
  privateJwk: JsonWebKey,
): Promise<string> {
  const key = await jose.importJWK(privateJwk);
  const { plaintext } = await jose.compactDecrypt(jwe, key);
  return new TextDecoder().decode(plaintext);
}

/** Generate an ephemeral P-256 key pair for verifier encryption JWKS. */
export async function generateVerifierEncryptionKeyPair(): Promise<{
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}> {
  const { publicKey, privateKey } = await jose.generateKeyPair("ECDH-ES", {
    crv: "P-256",
    extractable: true,
  });
  const publicJwk = await jose.exportJWK(publicKey);
  const privateJwk = await jose.exportJWK(privateKey);
  publicJwk.alg = DEFAULT_ALG;
  publicJwk.use = "enc";
  publicJwk.kid = publicJwk.kid ?? "ows-verifier-enc-1";
  privateJwk.alg = DEFAULT_ALG;
  privateJwk.kid = publicJwk.kid;
  return { publicJwk, privateJwk };
}

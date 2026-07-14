import * as jose from "jose";
import type { IWalletAttestationProvider } from "@1shotapi/ows-types";

export type DemoWalletAttestationOptions = {
  /** Signing private JWK (OKP Ed25519 or EC). */
  privateJwk: JsonWebKey;
  /** Optional issuer claim for the attestation JWT. */
  issuer?: string;
};

/**
 * Demo attestation provider: signs a compact JWT with `typ: oauth-client-attestation+jwt`
 * style claims. Not a production trust-rooted attestation.
 */
export class DemoWalletAttestationProvider implements IWalletAttestationProvider {
  constructor(private readonly options: DemoWalletAttestationOptions) {}

  async createAttestation(input: {
    audience: string;
    nonce?: string;
  }): Promise<string> {
    const alg =
      this.options.privateJwk.crv === "Ed25519" ||
      this.options.privateJwk.kty === "OKP"
        ? "EdDSA"
        : "ES256";
    const key = await jose.importJWK(this.options.privateJwk, alg);
    const now = Math.floor(Date.now() / 1000);
    return new jose.SignJWT({
      ...(input.nonce ? { nonce: input.nonce } : {}),
    })
      .setProtectedHeader({
        alg,
        typ: "oauth-client-attestation+jwt",
      })
      .setIssuer(this.options.issuer ?? "ows-demo-wallet")
      .setAudience(input.audience)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(key);
  }
}

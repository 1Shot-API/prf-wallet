import { Base64UrlEncodedString } from "../../primitives/Base64UrlEncodedString.js";
import { JWKThumbprint } from "../../primitives/JWKThumbprint.js";
import {
  OID4VCI_PROOF_JWT_TYP,
  type BuildOid4vciProofJwtInput,
  type VerifyOid4vciProofJwtInput,
  type VerifyOid4vciProofJwtResult,
} from "../../credentials/oid4vci-proof.js";
import {
  encodeJsonBase64Url,
  decodeJsonBase64Url,
  bytesToBase64Url,
  sdJwtHasher,
  verifyEd25519,
} from "./sd-jwt-vc/crypto.js";

type ProofHeader = {
  typ?: string;
  alg?: string;
  jwk?: JsonWebKey;
};

type ProofPayload = {
  aud?: string;
  iat?: number;
  nonce?: string;
};

function publicJwkOnly(jwk: JsonWebKey): JsonWebKey {
  const { kty, crv, x, y, e, n } = jwk;
  const pub: JsonWebKey = { kty };
  if (crv !== undefined) pub.crv = crv;
  if (x !== undefined) pub.x = x;
  if (y !== undefined) pub.y = y;
  if (e !== undefined) pub.e = e;
  if (n !== undefined) pub.n = n;
  return pub;
}

function requiredMembersForThumbprint(
  jwk: JsonWebKey,
): Record<string, string> {
  const kty = jwk.kty;
  if (!kty) {
    throw new Error("ProofUtils.jwkThumbprint: missing kty");
  }

  if (kty === "OKP") {
    if (!jwk.crv || !jwk.x) {
      throw new Error("ProofUtils.jwkThumbprint: OKP requires crv and x");
    }
    return { crv: jwk.crv, kty, x: jwk.x };
  }

  if (kty === "EC") {
    if (!jwk.crv || !jwk.x || !jwk.y) {
      throw new Error("ProofUtils.jwkThumbprint: EC requires crv, x, and y");
    }
    return { crv: jwk.crv, kty, x: jwk.x, y: jwk.y };
  }

  if (kty === "RSA") {
    if (!jwk.e || !jwk.n) {
      throw new Error("ProofUtils.jwkThumbprint: RSA requires e and n");
    }
    return { e: jwk.e, kty, n: jwk.n };
  }

  throw new Error(`ProofUtils.jwkThumbprint: unsupported kty ${kty}`);
}

/**
 * OID4VCI proof-of-possession and JWK identity helpers for credential issuance.
 */
export class ProofUtils {
  /**
   * Builds an OID4VCI `openid4vci-proof+jwt` proving possession of the holder key.
   * Signed with {@link HolderSigner.signKbJwt} (EdDSA signing input).
   */
  static async buildOid4vciProofJwt(
    input: BuildOid4vciProofJwtInput,
  ): Promise<string> {
    const holderJwk = publicJwkOnly(await input.holderSigner.publicKeyJwk());
    const header: ProofHeader = {
      typ: OID4VCI_PROOF_JWT_TYP,
      alg: "EdDSA",
      jwk: holderJwk,
    };
    const payload: ProofPayload = {
      aud: input.audience,
      iat: Math.floor(Date.now() / 1000),
    };
    if (input.nonce !== undefined) {
      payload.nonce = input.nonce;
    }

    const signingInput = `${encodeJsonBase64Url(header)}.${encodeJsonBase64Url(payload)}`;
    const signature = await input.holderSigner.signKbJwt(signingInput);
    return `${signingInput}.${signature}`;
  }

  /** Verifies an OID4VCI proof JWT and returns the holder public key from the header. */
  static async verifyOid4vciProofJwt(
    input: VerifyOid4vciProofJwtInput,
  ): Promise<VerifyOid4vciProofJwtResult> {
    const reasons: string[] = [];
    const parts = input.jwt.split(".");
    if (parts.length !== 3) {
      return {
        valid: false,
        reasons: ["OID4VCI proof JWT must have three segments"],
      };
    }

    const [headerB64, payloadB64, signatureB64] = parts as [
      string,
      string,
      string,
    ];
    let header: ProofHeader;
    let payload: ProofPayload;
    try {
      header = decodeJsonBase64Url<ProofHeader>(headerB64);
      payload = decodeJsonBase64Url<ProofPayload>(payloadB64);
    } catch {
      return {
        valid: false,
        reasons: ["OID4VCI proof JWT header/payload is not valid JSON"],
      };
    }

    if (header.typ !== OID4VCI_PROOF_JWT_TYP) {
      reasons.push(`Unexpected proof typ: ${header.typ ?? "(missing)"}`);
    }
    if (header.alg !== "EdDSA") {
      reasons.push(`Unsupported proof alg: ${header.alg ?? "(missing)"}`);
    }
    if (!header.jwk) {
      reasons.push("OID4VCI proof JWT header missing jwk");
      return { valid: false, reasons };
    }

    if (payload.aud !== input.expectedAudience) {
      reasons.push(
        `Proof audience mismatch: expected ${input.expectedAudience}, got ${payload.aud ?? "(missing)"}`,
      );
    }
    if (
      input.expectedNonce !== undefined &&
      payload.nonce !== input.expectedNonce
    ) {
      reasons.push(
        `Proof nonce mismatch: expected ${input.expectedNonce}, got ${payload.nonce ?? "(missing)"}`,
      );
    }

    const signingInput = `${headerB64}.${payloadB64}`;
    const holderPublicKeyJwk = publicJwkOnly(header.jwk);
    const sigOk = await verifyEd25519(
      holderPublicKeyJwk,
      signingInput,
      Base64UrlEncodedString(signatureB64),
    );
    if (!sigOk) {
      reasons.push("OID4VCI proof JWT signature invalid");
    }

    return {
      valid: reasons.length === 0,
      holderPublicKeyJwk,
      reasons,
    };
  }

  /**
   * RFC 7638 JWK Thumbprint (SHA-256), returned as branded base64url.
   * Supports OKP (Ed25519/X25519), EC, and RSA public members used in OWS.
   */
  static async jwkThumbprint(jwk: JsonWebKey): Promise<JWKThumbprint> {
    const members = requiredMembersForThumbprint(jwk);
    const canonical = JSON.stringify(members, Object.keys(members).sort());
    const digest = await sdJwtHasher(canonical, "sha-256");
    return JWKThumbprint(bytesToBase64Url(digest));
  }

  /** True when two JWKs share the same RFC 7638 thumbprint. */
  static async jwksEqualsByThumbprint(
    a: JsonWebKey,
    b: JsonWebKey,
  ): Promise<boolean> {
    const [ta, tb] = await Promise.all([
      ProofUtils.jwkThumbprint(a),
      ProofUtils.jwkThumbprint(b),
    ]);
    return ta === tb;
  }
}

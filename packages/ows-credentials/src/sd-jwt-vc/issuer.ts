import type { Signer, Verifier } from "@sd-jwt/core";
import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import { Base64UrlEncodedString, type CredentialClaimName } from "@1shotapi/ows-types";
import {
  sdJwtHasher,
  sdJwtSaltGenerator,
  signEd25519,
  verifyEd25519,
} from "./crypto.js";
import { DEMO_ISSUER_PRIVATE_JWK, DEMO_ISSUER_PUBLIC_JWK } from "./demo-keys.js";

export type IssueSdJwtVcInput = {
  issuer: string;
  vct: string;
  claims: Record<string, unknown>;
  /** Claim keys eligible for selective disclosure. */
  disclosableClaims: CredentialClaimName[];
  holderPublicKeyJwk: JsonWebKey;
  iat?: number;
};

export function createEd25519SignerFromJwk(privateJwk: JsonWebKey): Signer {
  return (data) => signEd25519(privateJwk, data);
}

export function createEd25519VerifierFromJwk(publicJwk: JsonWebKey): Verifier {
  return (data, sig) => verifyEd25519(publicJwk, data, Base64UrlEncodedString(sig));
}

/** Issues a demo SD-JWT VC using the mock issuer keypair. */
export async function issueDemoSdJwtVc(input: IssueSdJwtVcInput): Promise<string> {
  const sdjwt = new SDJwtVcInstance({
    signer: createEd25519SignerFromJwk(DEMO_ISSUER_PRIVATE_JWK),
    signAlg: "EdDSA",
    verifier: createEd25519VerifierFromJwk(DEMO_ISSUER_PUBLIC_JWK),
    hasher: sdJwtHasher,
    hashAlg: "sha-256",
    saltGenerator: sdJwtSaltGenerator,
  });

  const iat = input.iat ?? Math.floor(Date.now() / 1000);
  const disclosureFrame = {
    _sd: input.disclosableClaims.map(String),
  };

  return sdjwt.issue(
    {
      iss: input.issuer,
      iat,
      vct: input.vct,
      cnf: { jwk: input.holderPublicKeyJwk },
      ...input.claims,
    } as Parameters<SDJwtVcInstance["issue"]>[0],
    disclosureFrame as unknown as Parameters<SDJwtVcInstance["issue"]>[1],
  );
}

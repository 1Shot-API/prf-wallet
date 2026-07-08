import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import type { CredentialClaimName } from "@1shotapi/ows-types";
import {
  createEd25519SignerFromJwk,
  createEd25519VerifierFromJwk,
  sdJwtHasher,
  sdJwtSaltGenerator,
  signEd25519,
} from "@1shotapi/ows-wallet-utils";

/** TEST ONLY — matches examples/credentials-shared demo issuer key. */
export const DEMO_ISSUER_PRIVATE_JWK: JsonWebKey = {
  crv: "Ed25519",
  d: "pcLAFtmJw-OtcPm7taGhEDocf63HfBk5TMXWSoF6rvw",
  x: "ObRX6jKS0AbsXx3ICSIiozuqzYUXXrQhlj4GkeqXfbs",
  kty: "OKP",
};

export const DEMO_ISSUER_PUBLIC_JWK: JsonWebKey = {
  crv: "Ed25519",
  x: "ObRX6jKS0AbsXx3ICSIiozuqzYUXXrQhlj4GkeqXfbs",
  kty: "OKP",
};

export const DEMO_HOLDER_PRIVATE_JWK: JsonWebKey = {
  crv: "Ed25519",
  d: "G8_8M9RjEA5L5NIeAoB24C9yOb8KPuRoh9y7SidoXJA",
  x: "3dmWOAMTtkMxm88aJ9QhlK5SWimNXt6-WTsI4eFHwC8",
  kty: "OKP",
};

export const DEMO_HOLDER_PUBLIC_JWK: JsonWebKey = {
  crv: "Ed25519",
  x: "3dmWOAMTtkMxm88aJ9QhlK5SWimNXt6-WTsI4eFHwC8",
  kty: "OKP",
};

export async function issueDemoSdJwtVc(input: {
  issuer: string;
  vct: string;
  claims: Record<string, unknown>;
  disclosableClaims: CredentialClaimName[];
  holderPublicKeyJwk: JsonWebKey;
}): Promise<string> {
  const sdjwt = new SDJwtVcInstance({
    signer: createEd25519SignerFromJwk(DEMO_ISSUER_PRIVATE_JWK),
    signAlg: "EdDSA",
    verifier: createEd25519VerifierFromJwk(DEMO_ISSUER_PUBLIC_JWK),
    hasher: sdJwtHasher,
    hashAlg: "sha-256",
    saltGenerator: sdJwtSaltGenerator,
  });

  const iat = Math.floor(Date.now() / 1000);
  return sdjwt.issue(
    {
      iss: input.issuer,
      iat,
      vct: input.vct,
      cnf: { jwk: input.holderPublicKeyJwk },
      ...input.claims,
    } as Parameters<SDJwtVcInstance["issue"]>[0],
    { _sd: input.disclosableClaims.map(String) } as Parameters<
      SDJwtVcInstance["issue"]
    >[1],
  );
}

export function createDemoHolderSigner() {
  const publicJwk = { ...DEMO_HOLDER_PRIVATE_JWK };
  delete publicJwk.d;
  return {
    async publicKeyJwk() {
      return publicJwk;
    },
    async signKbJwt(unsignedJwt: string) {
      return signEd25519(DEMO_HOLDER_PRIVATE_JWK, unsignedJwt);
    },
  };
}

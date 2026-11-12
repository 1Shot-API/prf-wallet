import { SDJwtVcInstance } from "@sd-jwt/sd-jwt-vc";
import {
  CredentialCryptoUtils,
  type CredentialClaimName,
} from "@1shotapi/ows-types";
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

/** Issues a demo SD-JWT VC using the mock issuer keypair. */
export async function issueDemoSdJwtVc(input: IssueSdJwtVcInput): Promise<string> {
  const sdjwt = new SDJwtVcInstance({
    signer: CredentialCryptoUtils.createEd25519Signer(DEMO_ISSUER_PRIVATE_JWK),
    signAlg: "EdDSA",
    verifier: CredentialCryptoUtils.createEd25519Verifier(DEMO_ISSUER_PUBLIC_JWK),
    hasher: CredentialCryptoUtils.hasher,
    hashAlg: "sha-256",
    saltGenerator: CredentialCryptoUtils.saltGenerator,
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

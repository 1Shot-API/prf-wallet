import type { IHolderSigner } from "@1shotapi/ows-types";
import { signEd25519 } from "@1shotapi/ows-types";
import { DEMO_HOLDER_PRIVATE_JWK } from "./demo-keys.js";

/** `IHolderSigner` from an Ed25519 JWK private key (Web Crypto). */
export function createEd25519HolderSignerFromJwk(privateJwk: JsonWebKey): IHolderSigner {
  const publicJwk = { ...privateJwk };
  delete publicJwk.d;
  return {
    async publicKeyJwk() {
      return publicJwk;
    },
    async signKbJwt(unsignedJwt) {
      return signEd25519(privateJwk, unsignedJwt);
    },
  };
}

/** Demo holder signer for mocks/tests when no wallet key is available. */
export function createDemoHolderSigner(): IHolderSigner {
  return createEd25519HolderSignerFromJwk(DEMO_HOLDER_PRIVATE_JWK);
}

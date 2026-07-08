import type { HolderSigner } from "./holder-signer.js";
import { signEd25519 } from "./crypto.js";
import { DEMO_HOLDER_PRIVATE_JWK } from "./demo-keys.js";

/** `HolderSigner` from an Ed25519 JWK private key (Web Crypto). */
export function createEd25519HolderSignerFromJwk(privateJwk: JsonWebKey): HolderSigner {
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
export function createDemoHolderSigner(): HolderSigner {
  return createEd25519HolderSignerFromJwk(DEMO_HOLDER_PRIVATE_JWK);
}

/** @deprecated Use `createEd25519HolderSignerFromJwk`. */
export const createNodeEd25519HolderSigner = createEd25519HolderSignerFromJwk;

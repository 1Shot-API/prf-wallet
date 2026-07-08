import type { Base64UrlEncodedString } from "@1shotapi/ows-types";
import type { Signer } from "@sd-jwt/core";

/** Holder key used for SD-JWT VC key binding (`kb+jwt`). Branding wires this to the OWS signer. */
export interface HolderSigner {
  /** Ed25519 public key as JWK (`cnf.jwk` at issuance; kb+jwt verification). */
  publicKeyJwk(): Promise<JsonWebKey>;
  /** Signs the kb+jwt unsigned token (UTF-8 JWT signing input). */
  signKbJwt(unsignedJwt: string): Promise<Base64UrlEncodedString>;
}

/** Adapts a `HolderSigner` to the `@sd-jwt/core` kbSigner callback. */
export function holderSignerToKbSigner(holder: HolderSigner): Signer {
  return (data) => holder.signKbJwt(data);
}

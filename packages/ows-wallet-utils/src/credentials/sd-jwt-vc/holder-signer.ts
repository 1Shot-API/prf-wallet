import type { Signer } from "@sd-jwt/core";
import type { HolderSigner } from "@1shotapi/ows-types";

/** Adapts a `HolderSigner` to the `@sd-jwt/core` kbSigner callback. */
export function holderSignerToKbSigner(holder: HolderSigner): Signer {
  return (data) => holder.signKbJwt(data);
}

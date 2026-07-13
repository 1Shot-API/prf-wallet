import type { Signer } from "@sd-jwt/core";
import type { HolderSigner } from "../../../credentials/holder-signer.js";

/** Adapts a `HolderSigner` to the `@sd-jwt/core` kbSigner callback. */
export function holderSignerToKbSigner(holder: HolderSigner): Signer {
  return (data) => holder.signKbJwt(data);
}

import type { Signer } from "@sd-jwt/core";
import type { IHolderSigner } from "../../../credentials/holder-signer.js";

/** Adapts a `IHolderSigner` to the `@sd-jwt/core` kbSigner callback. */
export function holderSignerToKbSigner(holder: IHolderSigner): Signer {
  return (data) => holder.signKbJwt(data);
}

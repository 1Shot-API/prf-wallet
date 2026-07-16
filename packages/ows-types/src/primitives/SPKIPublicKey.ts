import { type Brand, make } from "ts-brand";

/**
 * SubjectPublicKeyInfo (SPKI) DER public key (base64url).
 * Browser `AuthenticatorAttestationResponse.getPublicKey()` form;
 * suitable for Web Crypto `importKey` / Node `createPublicKey`.
 * Convert from {@link COSEPublicKey} via `COSEToSPKIPublicKey` in
 * `@1shotapi/ows-signer-utils` when needed.
 */
export type SPKIPublicKey = Brand<string, "SPKIPublicKey">;
export const SPKIPublicKey = make<SPKIPublicKey>();

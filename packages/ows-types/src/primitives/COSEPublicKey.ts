import { type Brand, make } from "ts-brand";

/**
 * WebAuthn authenticator credential public key as COSE CBOR (base64url).
 * Native form from attestation authenticator data (`credentialPublicKey`).
 * Use with `@simplewebauthn/server` and OWS passkey registration.
 */
export type COSEPublicKey = Brand<string, "COSEPublicKey">;
export const COSEPublicKey = make<COSEPublicKey>();

import { type Brand, make } from "ts-brand";

/** WebAuthn / COSE passkey public key (base64url). */
export type PasskeyPublicKey = Brand<string, "PasskeyPublicKey">;
export const PasskeyPublicKey = make<PasskeyPublicKey>();

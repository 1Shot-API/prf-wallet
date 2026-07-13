import { type Brand, make } from "ts-brand";

/** Stable identifier for a credential held in the wallet store. */
export type CredentialId = Brand<string, "CredentialId">;
export const CredentialId = make<CredentialId>();

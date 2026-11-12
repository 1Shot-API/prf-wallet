import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Stable identifier for a credential held in the wallet store
 * (WebAuthn credential id or store-local id).
 *
 * Example: `"cred_1719792000_ab12cd"`
 */
export type CredentialId = Brand<string, "CredentialId">;
export const CredentialId = make<CredentialId>();

/** Zod schema: non-empty credential id. */
export const CredentialIdSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential id" })
  .transform((s) => CredentialId(s));

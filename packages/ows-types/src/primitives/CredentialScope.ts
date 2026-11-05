import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * OID4 / credential scope string.
 *
 * Example: `"openid"`
 */
export type CredentialScope = Brand<string, "CredentialScope">;
export const CredentialScope = make<CredentialScope>();

/** Zod schema: non-empty credential scope. */
export const CredentialScopeSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential scope" })
  .transform((s) => CredentialScope(s));

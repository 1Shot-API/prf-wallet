import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * SD-JWT claim name within a credential.
 *
 * Example: `"given_name"`
 */
export type CredentialClaimName = Brand<string, "CredentialClaimName">;
export const CredentialClaimName = make<CredentialClaimName>();

/** Zod schema: non-empty claim name. */
export const CredentialClaimNameSchema = z
  .string()
  .min(1, { message: "must be a non-empty claim name" })
  .transform((s) => CredentialClaimName(s));

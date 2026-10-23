import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Credential encoding format identifier from issuer metadata.
 *
 * Example: `"sd-jwt-vc"`
 */
export type CredentialFormatId = Brand<string, "CredentialFormatId">;
export const CredentialFormatId = make<CredentialFormatId>();

/** Zod schema: non-empty OID4 format id. */
export const CredentialFormatIdSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential format id" })
  .transform((s) => CredentialFormatId(s));

import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * SD-JWT / VC type name.
 *
 * Example: `"VerifiableCredential"`
 */
export type CredentialTypeName = Brand<string, "CredentialTypeName">;
export const CredentialTypeName = make<CredentialTypeName>();

/** Zod schema: non-empty credential type name. */
export const CredentialTypeNameSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential type name" })
  .transform((s) => CredentialTypeName(s));

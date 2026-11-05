import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * OID4VCI credential configuration identifier.
 *
 * Example: `"KycCredential"`
 */
export type CredentialConfigurationId = Brand<
  string,
  "CredentialConfigurationId"
>;
export const CredentialConfigurationId = make<CredentialConfigurationId>();

/** Zod schema: non-empty OID4 credential configuration id. */
export const CredentialConfigurationIdSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential configuration id" })
  .transform((s) => CredentialConfigurationId(s));

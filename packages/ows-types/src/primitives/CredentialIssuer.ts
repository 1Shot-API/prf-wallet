import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Credential issuer identifier (typically an HTTPS origin or DID).
 *
 * Example: `"https://issuer.example"`
 */
export type CredentialIssuer = Brand<string, "CredentialIssuer">;
export const CredentialIssuer = make<CredentialIssuer>();

/** Zod schema: non-empty credential issuer id. */
export const CredentialIssuerSchema = z
  .string()
  .min(1, { message: "must be a non-empty credential issuer" })
  .transform((s) => CredentialIssuer(s));

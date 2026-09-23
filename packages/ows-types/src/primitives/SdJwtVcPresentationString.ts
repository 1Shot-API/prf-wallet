import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * SD-JWT VC compact serialization for OID4VP presentation
 * (`issuer-jwt~disclosure~…~kb+jwt`).
 *
 * Example: `"eyJhbGciOiJFUzI1NiJ9.…~WyJ…~"`
 */
export type SdJwtVcPresentationString = Brand<
  string,
  "SdJwtVcPresentationString"
>;
export const SdJwtVcPresentationString = make<SdJwtVcPresentationString>();

/** Zod schema: non-empty SD-JWT VC presentation string. */
export const SdJwtVcPresentationStringSchema = z
  .string()
  .min(1, { message: "must be a non-empty SD-JWT VC presentation" })
  .transform((s) => SdJwtVcPresentationString(s));

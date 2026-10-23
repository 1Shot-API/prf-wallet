import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * URI referencing an OID4VCI credential offer (HTTPS, `openid-credential-offer:`, or mock scheme).
 *
 * Example: `"openid-credential-offer://?credential_offer=…"`
 */
export type CredentialOfferUri = Brand<string, "CredentialOfferUri">;
export const CredentialOfferUri = make<CredentialOfferUri>();

function isUriLike(s: string): boolean {
  if (!s.trim()) {
    return false;
  }
  try {
    // eslint-disable-next-line no-new
    new URL(s);
    return true;
  } catch {
    return /^[a-z][a-z0-9+.-]*:/i.test(s);
  }
}

/** Zod schema: credential offer URI (http(s) or custom scheme). */
export const CredentialOfferUriSchema = z
  .string()
  .refine(isUriLike, { message: "must be a valid credential offer URI" })
  .transform((s) => CredentialOfferUri(s));

import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Full URI including scheme and typically a path (e.g. `https://example.com/foo`,
 * `openid-credential-offer:…`). For hostname-only values, use {@link DomainString}.
 *
 * Example: `"https://example.com/callback"`
 */
export type UriString = Brand<string, "UriString">;
export const UriString = make<UriString>();

function isUriLike(s: string): boolean {
  if (!s.trim()) {
    return false;
  }
  try {
    // Absolute http(s) / known schemes
    // eslint-disable-next-line no-new
    new URL(s);
    return true;
  } catch {
    // Custom schemes used by OID4 mocks (e.g. openid-credential-offer:…)
    return /^[a-z][a-z0-9+.-]*:/i.test(s);
  }
}

/** Zod schema: absolute URL or custom-scheme URI. */
export const UriStringSchema = z
  .string()
  .refine(isUriLike, { message: "must be a valid URI" })
  .transform((s) => UriString(s));

import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * URI referencing an OID4VP presentation request.
 *
 * Example: `"https://verifier.example/request/abc"`
 */
export type PresentationRequestUri = Brand<string, "PresentationRequestUri">;
export const PresentationRequestUri = make<PresentationRequestUri>();

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

/** Zod schema: presentation request URI. */
export const PresentationRequestUriSchema = z
  .string()
  .refine(isUriLike, { message: "must be a valid presentation request URI" })
  .transform((s) => PresentationRequestUri(s));

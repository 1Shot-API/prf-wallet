import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * DNS hostname / domain without scheme or path (e.g. `example.com`, `app.example.com`,
 * `localhost`). Does not include a protocol or path — use {@link UriString} for full
 * URLs such as `https://example.com/foo`.
 *
 * Example: `"wallet.1shotapi.com"`
 */
export type DomainString = Brand<string, "DomainString">;
export const DomainString = make<DomainString>();

/** Zod schema: non-empty hostname / domain (no scheme). */
export const DomainStringSchema = z
  .string()
  .min(1, { message: "must be a non-empty domain" })
  .refine((s) => !s.includes("://") && !s.includes("/"), {
    message: "must be a hostname without scheme or path",
  })
  .transform((s) => DomainString(s));

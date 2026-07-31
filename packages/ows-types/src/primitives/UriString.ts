import { type Brand, make } from "ts-brand";

/**
 * Full URI including scheme and typically a path (e.g. `https://example.com/foo`,
 * `openid-credential-offer:…`). For hostname-only values, use {@link DomainString}.
 */
export type UriString = Brand<string, "UriString">;
export const UriString = make<UriString>();

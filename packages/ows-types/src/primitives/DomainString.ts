import { type Brand, make } from "ts-brand";

/**
 * DNS hostname / domain without scheme or path (e.g. `example.com`, `app.example.com`,
 * `localhost`). Does not include a protocol or path — use {@link UriString} for full
 * URLs such as `https://example.com/foo`.
 */
export type DomainString = Brand<string, "DomainString">;
export const DomainString = make<DomainString>();

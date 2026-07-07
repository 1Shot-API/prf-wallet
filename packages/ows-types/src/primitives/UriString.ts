import { type Brand, make } from "ts-brand";

/** Generic URI string (HTTPS, custom scheme, `openid-credential-offer:`, etc.). */
export type UriString = Brand<string, "UriString">;
export const UriString = make<UriString>();

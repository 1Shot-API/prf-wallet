import { type Brand, make } from "ts-brand";

/** Base64url-encoded string (no padding, `-`/`_` alphabet). */
export type Base64UrlEncodedString = Brand<string, "Base64UrlEncodedString">;
export const Base64UrlEncodedString = make<Base64UrlEncodedString>();

import { type Brand, make } from "ts-brand";

/** RFC 7638 JWK Thumbprint (SHA-256), base64url-encoded. */
export type JWKThumbprint = Brand<string, "JWKThumbprint">;
export const JWKThumbprint = make<JWKThumbprint>();

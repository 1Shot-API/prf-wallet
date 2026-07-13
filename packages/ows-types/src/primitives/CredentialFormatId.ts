import { type Brand, make } from "ts-brand";

/** Credential encoding format identifier from issuer metadata (e.g. `sd-jwt-vc`, `jwt_vc_json`). */
export type CredentialFormatId = Brand<string, "CredentialFormatId">;
export const CredentialFormatId = make<CredentialFormatId>();

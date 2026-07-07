import { type Brand, make } from "ts-brand";

/** OID4VCI credential issuer identifier (HTTPS URL or DID). */
export type CredentialIssuer = Brand<string, "CredentialIssuer">;
export const CredentialIssuer = make<CredentialIssuer>();

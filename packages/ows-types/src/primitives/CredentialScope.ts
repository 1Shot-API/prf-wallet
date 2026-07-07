import { type Brand, make } from "ts-brand";

/** OID4VCI credential scope string from issuer metadata. */
export type CredentialScope = Brand<string, "CredentialScope">;
export const CredentialScope = make<CredentialScope>();

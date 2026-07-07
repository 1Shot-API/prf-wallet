import { type Brand, make } from "ts-brand";

/** OID4VCI credential configuration identifier (e.g. `KycCredential`). */
export type CredentialConfigurationId = Brand<string, "CredentialConfigurationId">;
export const CredentialConfigurationId = make<CredentialConfigurationId>();

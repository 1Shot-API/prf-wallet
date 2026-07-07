import { type Brand, make } from "ts-brand";

/** W3C VC `type` entry (e.g. `VerifiableCredential`, `KycCredential`). */
export type CredentialTypeName = Brand<string, "CredentialTypeName">;
export const CredentialTypeName = make<CredentialTypeName>();

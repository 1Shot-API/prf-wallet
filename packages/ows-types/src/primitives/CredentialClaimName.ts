import { type Brand, make } from "ts-brand";

/** Credential subject or presentation claim name (e.g. `ageOver18`, `country`). */
export type CredentialClaimName = Brand<string, "CredentialClaimName">;
export const CredentialClaimName = make<CredentialClaimName>();

import { type Brand, make } from "ts-brand";

/** URI referencing an OID4VCI credential offer (HTTPS, `openid-credential-offer:`, or mock scheme). */
export type CredentialOfferUri = Brand<string, "CredentialOfferUri">;
export const CredentialOfferUri = make<CredentialOfferUri>();

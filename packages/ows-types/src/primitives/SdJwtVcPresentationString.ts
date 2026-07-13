import { type Brand, make } from "ts-brand";

/**
 * SD-JWT VC compact serialization for OID4VP presentation
 * (`issuer-jwt~disclosure~…~kb+jwt`).
 */
export type SdJwtVcPresentationString = Brand<string, "SdJwtVcPresentationString">;
export const SdJwtVcPresentationString = make<SdJwtVcPresentationString>();

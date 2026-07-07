import { type Brand, make } from "ts-brand";

/** URI referencing an OID4VP presentation request (HTTPS, `openid4vp:`, or mock scheme). */
export type PresentationRequestUri = Brand<string, "PresentationRequestUri">;
export const PresentationRequestUri = make<PresentationRequestUri>();

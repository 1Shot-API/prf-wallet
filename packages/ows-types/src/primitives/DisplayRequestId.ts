import { type Brand, make } from "ts-brand";

/** Correlates a branding-layer display request with the host response. */
export type DisplayRequestId = Brand<string, "DisplayRequestId">;
export const DisplayRequestId = make<DisplayRequestId>();

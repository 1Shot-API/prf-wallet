import { type Brand, make } from "ts-brand";

/** Client-generated UUID correlating a Branding→Host analytics notification. */
export type AnalyticsEventId = Brand<string, "AnalyticsEventId">;
export const AnalyticsEventId = make<AnalyticsEventId>();

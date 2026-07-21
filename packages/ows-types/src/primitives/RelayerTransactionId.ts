import { type Brand, make } from "ts-brand";

/**
 * Opaque id returned by a 1Shot (or interim) relayer submit.
 * Placeholder until the public relayer assigns stable task ids.
 */
export type RelayerTransactionId = Brand<string, "RelayerTransactionId">;
export const RelayerTransactionId = make<RelayerTransactionId>();

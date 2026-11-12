import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Opaque id returned by a 1Shot (or interim) relayer submit — `0x`-prefixed hex.
 *
 * Example: `"0xdeadbeef…"`
 */
export type RelayerTransactionId = Brand<`0x${string}`, "RelayerTransactionId">;
export const RelayerTransactionId = make<RelayerTransactionId>();

/** Zod schema: non-empty 0x-prefixed hex relayer task id. */
export const RelayerTransactionIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, {
    message: "must be a non-empty 0x-prefixed hex relayer transaction id",
  })
  .transform((s) => RelayerTransactionId(s as `0x${string}`));

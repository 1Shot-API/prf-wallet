import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A monotonically increasing number for RPC calls.
 *
 * Example: `1`
 */
export type RPCCallId = Brand<number, "RPCCallId">;
export const RPCCallId = make<RPCCallId>();

/** Zod schema: non-negative integer RPC call id. */
export const RPCCallIdSchema = z
  .number()
  .int()
  .nonnegative()
  .transform((n) => RPCCallId(n));

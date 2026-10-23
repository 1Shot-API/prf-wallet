import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A 32-byte Ethereum transaction hash (`0x` + 64 hex chars).
 *
 * Example: `"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"`
 */
export type EVMTransactionHash = Brand<`0x${string}`, "EVMTransactionHash">;
export const EVMTransactionHash = make<EVMTransactionHash>();

/** Zod schema: 0x-prefixed 32-byte hex hash. */
export const EVMTransactionHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, {
    message: "must be a 32-byte 0x hex transaction hash",
  })
  .transform((s) => EVMTransactionHash(s as `0x${string}`));

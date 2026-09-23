import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * A 32-byte Bitcoin transaction hash / txid as a 64-character hex string
 * **without** a `0x` prefix (Bitcoin wire convention; not a viem Hex type).
 *
 * Example: `"f007551f169722ce74104d6673bd46ce193c624b8550889526d1b93820d725f7"`
 */
export type BitcoinTransactionHash = Brand<string, "BitcoinTransactionHash">;
export const BitcoinTransactionHash = make<BitcoinTransactionHash>();

/** Zod schema: 64 hex chars, no 0x prefix. */
export const BitcoinTransactionHashSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{64}$/, {
    message: "must be a 32-byte hex Bitcoin txid without 0x prefix",
  })
  .transform((s) => BitcoinTransactionHash(s.toLowerCase()));

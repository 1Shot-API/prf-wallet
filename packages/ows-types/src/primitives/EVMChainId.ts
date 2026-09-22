import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * EIP-155 chain id as a `0x`-prefixed hex string (EIP-1193 `eth_chainId` form).
 * Schemas normalize leading zeros so `"0x01"` and `"0x1"` compare equal.
 *
 * Example: `"0x1"` (Ethereum mainnet), `"0x13b2"` (Arc)
 */
export type EVMChainId = Brand<`0x${string}`, "EVMChainId">;
export const EVMChainId = make<EVMChainId>();

/** Zod schema: 0x hex chain id, normalized (no leading zeros in the hex body). */
export const EVMChainIdSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]+$/, { message: "must be a 0x-prefixed hex chain id" })
  .transform((value) =>
    EVMChainId(`0x${BigInt(value).toString(16)}` as `0x${string}`),
  );

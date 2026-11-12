import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * 4-byte EVM function selector (first 4 bytes of calldata), lowercase `0x`-prefixed hex.
 *
 * Example: `"0xa9059cbb"` (ERC-20 `transfer(address,uint256)`)
 */
export type EVMFunctionSelector = Brand<`0x${string}`, "EVMFunctionSelector">;
export const EVMFunctionSelector = make<EVMFunctionSelector>();

/** Zod schema: `0x` + 8 hex digits, normalized to lowercase. */
export const EVMFunctionSelectorSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{8}$/, { message: "must be a 4-byte 0x hex selector" })
  .transform((s) => EVMFunctionSelector(s.toLowerCase() as `0x${string}`));

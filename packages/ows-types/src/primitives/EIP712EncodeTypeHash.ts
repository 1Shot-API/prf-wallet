import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * `keccak256(encodeType(primaryType))` for an EIP-712 message (the EIP-712 type hash),
 * lowercase `0x`-prefixed 32-byte hex. ERC-7730 registries index EIP-712 descriptors by it.
 *
 * Example: `"0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9"` (ERC-2612 Permit)
 */
export type EIP712EncodeTypeHash = Brand<`0x${string}`, "EIP712EncodeTypeHash">;
export const EIP712EncodeTypeHash = make<EIP712EncodeTypeHash>();

/** Zod schema: `0x` + 64 hex digits, normalized to lowercase. */
export const EIP712EncodeTypeHashSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]{64}$/, { message: "must be a 32-byte 0x hex hash" })
  .transform((s) => EIP712EncodeTypeHash(s.toLowerCase() as `0x${string}`));

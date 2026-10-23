import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * `0x`-prefixed hex-encoded byte string (empty payload `0x` allowed).
 *
 * Example: `"0xdeadbeef"`
 */
export type HexString = Brand<`0x${string}`, "HexString">;
export const HexString = make<HexString>();

/** Zod schema: `0x` + hex digits (may be empty after prefix). */
export const HexStringSchema = z
  .string()
  .regex(/^0x[0-9a-fA-F]*$/, { message: "must be 0x-prefixed hex" })
  .transform((s) => HexString(s as `0x${string}`));

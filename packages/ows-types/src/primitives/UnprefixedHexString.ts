import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Hex-encoded byte string **without** a `0x` prefix (empty allowed).
 * Bitcoin wire convention (txids, raw transactions, OP_RETURN payloads,
 * message signatures). Use {@link HexString} for `0x`-prefixed hex.
 *
 * Example: `"deadbeef"`
 */
export type UnprefixedHexString = Brand<string, "UnprefixedHexString">;
export const UnprefixedHexString = make<UnprefixedHexString>();

/** Zod schema: even-length hex digits, no `0x` prefix. */
export const UnprefixedHexStringSchema = /* @__PURE__ */ z
  .string()
  .regex(/^(?:[0-9a-fA-F]{2})*$/, {
    message: "must be even-length hex without a 0x prefix",
  })
  .transform((s) => UnprefixedHexString(s));

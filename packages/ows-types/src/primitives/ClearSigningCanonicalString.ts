import { type Brand, make } from "ts-brand";

/**
 * Canonical, unformatted rendering of a decoded ERC-7730 clear-signing value: decimal integers,
 * checksummed addresses, `0x` hex bytes, UTF-8 strings, and `[…]` / `{k: v}` for arrays and structs.
 *
 * Produced by the clear-signing engine for raw views and for matching against descriptor
 * constants (`mustMatch`, `ifNotIn`, enum tables, map keys). Never parsed from the wire.
 *
 * Example: `"1500250000"`, `"0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"`
 */
export type ClearSigningCanonicalString = Brand<string, "ClearSigningCanonicalString">;
export const ClearSigningCanonicalString = make<ClearSigningCanonicalString>();

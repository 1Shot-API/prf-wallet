import { type Brand, make } from "ts-brand";

/** `0x`-prefixed hex-encoded byte string. */
export type HexString = Brand<`0x${string}`, "HexString">;
export const HexString = make<HexString>();

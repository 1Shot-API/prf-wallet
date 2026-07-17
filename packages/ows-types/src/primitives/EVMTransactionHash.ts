import { type Brand, make } from "ts-brand";

/**
 * A 32-byte Ethereum transaction hash (`0x` + 64 hex chars).
 * Example: `"0xabc…def"`.
 */
export type EVMTransactionHash = Brand<`0x${string}`, "EVMTransactionHash">;
export const EVMTransactionHash = make<EVMTransactionHash>();

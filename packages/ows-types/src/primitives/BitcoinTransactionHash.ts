import { type Brand, make } from "ts-brand";

/**
 * A 32-byte Bitcoin transaction hash / txid as a 64-character lowercase hex string without 0x prefix.
 * Example: "f007551f169722ce74104d6673bd46ce193c624b8550889526d1b93820d725f7"
 */
export type BitcoinTransactionHash = Brand<string, "BitcoinTransactionHash">;
export const BitcoinTransactionHash = make<BitcoinTransactionHash>();

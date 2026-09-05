import { type Brand, make } from "ts-brand";

/**
 * A hex-encoded Bitcoin wire signature (DER signature + SIGHASH byte, e.g. SIGHASH_ALL 0x01).
 * Example: "0x30440220...01"
 */
export type BitcoinSignatureHex = Brand<`0x${string}`, "BitcoinSignatureHex">;
export const BitcoinSignatureHex = make<BitcoinSignatureHex>();

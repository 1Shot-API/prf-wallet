import { type Brand, make } from "ts-brand";

/** Hex-encoded secp256k1 public key (`0x` + uncompressed or compressed bytes). */
export type SECP256K1PublicKey = Brand<`0x${string}`, "SECP256K1PublicKey">;
export const SECP256K1PublicKey = make<SECP256K1PublicKey>();

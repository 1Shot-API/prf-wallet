import { type Brand, make } from "ts-brand";

/** Hex-encoded Ed25519 public key (`0x` + 32 bytes). */
export type ED25519PublicKey = Brand<`0x${string}`, "ED25519PublicKey">;
export const ED25519PublicKey = make<ED25519PublicKey>();

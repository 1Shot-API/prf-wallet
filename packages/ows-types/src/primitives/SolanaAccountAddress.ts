import { type Brand, make } from "ts-brand";

/**
 * A base58-encoded Solana account address (32-byte ed25519 public key).
 * Example: "4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw"
 */
export type SolanaAccountAddress = Brand<string, "SolanaAccountAddress">;
export const SolanaAccountAddress = make<SolanaAccountAddress>();

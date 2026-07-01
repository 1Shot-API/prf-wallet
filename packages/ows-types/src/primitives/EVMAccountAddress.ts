import { type Brand, make } from "ts-brand";

/**
 * A hex string prefixed with "0x" and 40 characters.
 * Example: "0x1234567890abcdef1234567890abcdef12345678"
 */
export type EVMAccountAddress = Brand<`0x${string}`, "EVMAccountAddress">;
export const EVMAccountAddress = make<EVMAccountAddress>();

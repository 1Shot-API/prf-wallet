import { type Brand, make } from "ts-brand";

/**
 * EVM account address as an EIP-55 checksummed `0x`-prefixed hex string
 * (mixed-case, 40 hex digits). Prefer constructing via validation that
 * checksums (e.g. `AddressUtils.validateEVMAddress` / viem `getAddress`).
 *
 * Example: `"0xAbCdEf0123456789AbCdEf0123456789aBcDeF01"`
 */
export type EVMAccountAddress = Brand<`0x${string}`, "EVMAccountAddress">;
export const EVMAccountAddress = make<EVMAccountAddress>();

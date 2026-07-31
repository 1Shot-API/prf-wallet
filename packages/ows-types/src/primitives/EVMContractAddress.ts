import { type Brand, make } from "ts-brand";

/**
 * EVM smart-contract address as an EIP-55 checksummed `0x`-prefixed hex string
 * (mixed-case, 40 hex digits). Same address set as {@link EVMAccountAddress},
 * but branded separately so call sites do not mix EOAs / smart accounts with
 * contract deployments (enforcers, factories, tokens, etc.).
 *
 * Prefer constructing via validation that checksums (e.g. viem `getAddress`).
 *
 * Example: `"0xAbCdEf0123456789AbCdEf0123456789aBcDeF01"`
 */
export type EVMContractAddress = Brand<`0x${string}`, "EVMContractAddress">;
export const EVMContractAddress = make<EVMContractAddress>();

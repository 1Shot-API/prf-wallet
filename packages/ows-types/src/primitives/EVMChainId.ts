import { type Brand, make } from "ts-brand";

/**
 * EIP-155 chain id as a `0x`-prefixed hex string (EIP-1193 `eth_chainId` form).
 * Example: `0x1` (Ethereum mainnet).
 */
export type EVMChainId = Brand<`0x${string}`, "EVMChainId">;
export const EVMChainId = make<EVMChainId>();

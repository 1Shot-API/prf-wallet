import { type Brand, make } from "ts-brand";

/**
 * A Bitcoin chain id sentinel (`"Bitcoin"` mainnet, `"BitcoinTestnet"` testnet).
 */
export type BitcoinChainId = Brand<
  "Bitcoin" | "BitcoinTestnet",
  "BitcoinChainId"
>;
export const BitcoinChainId = make<BitcoinChainId>();

export const BITCOIN_MAINNET_CHAIN_ID: BitcoinChainId =
  BitcoinChainId("Bitcoin");
export const BITCOIN_TESTNET_CHAIN_ID: BitcoinChainId =
  BitcoinChainId("BitcoinTestnet");

export const BITCOIN_CAIP2 = {
  MAINNET: "bip122:000000000019d6689c085ae165831e93",
  TESTNET: "bip122:000000000933ea01ad0ee984209779ba",
} as const;

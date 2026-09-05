import { type Brand, make } from "ts-brand";

/**
 * A Bitcoin chain id sentinel (-1 for Mainnet, -2 for Testnet).
 */
export type BitcoinChainId = Brand<-1 | -2, "BitcoinChainId">;
export const BitcoinChainId = make<BitcoinChainId>();

export const BITCOIN_MAINNET_CHAIN_ID: BitcoinChainId = BitcoinChainId(-1);
export const BITCOIN_TESTNET_CHAIN_ID: BitcoinChainId = BitcoinChainId(-2);

export const BITCOIN_CAIP2 = {
  MAINNET: "bip122:000000000019d6689c085ae165831e93",
  TESTNET: "bip122:000000000933ea01ad0ee984209779ba",
} as const;

export function bitcoinChainIdToCaip2(chainId: BitcoinChainId): string {
  return chainId === BITCOIN_MAINNET_CHAIN_ID
    ? BITCOIN_CAIP2.MAINNET
    : BITCOIN_CAIP2.TESTNET;
}

export function caip2ToBitcoinChainId(caip2: string): BitcoinChainId | undefined {
  if (caip2 === BITCOIN_CAIP2.MAINNET) return BITCOIN_MAINNET_CHAIN_ID;
  if (caip2 === BITCOIN_CAIP2.TESTNET) return BITCOIN_TESTNET_CHAIN_ID;
  return undefined;
}

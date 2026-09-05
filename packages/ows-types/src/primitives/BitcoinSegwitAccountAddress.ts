import { type Brand, make } from "ts-brand";

/**
 * A Bitcoin Native SegWit (P2WPKH) account address.
 * Starts with "bc1q" on Bitcoin Mainnet or "tb1q" on Bitcoin Testnet.
 * Example: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
 */
export type BitcoinSegwitAccountAddress = Brand<string, "BitcoinSegwitAccountAddress">;
export const BitcoinSegwitAccountAddress = make<BitcoinSegwitAccountAddress>();

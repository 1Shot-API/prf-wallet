import { type Brand, make } from "ts-brand";

/**
 * A Bitcoin account address (base58 P2PKH/P2SH or bech32/bech32m).
 * Example: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"
 */
export type BitcoinAccountAddress = Brand<string, "BitcoinAccountAddress">;
export const BitcoinAccountAddress = make<BitcoinAccountAddress>();

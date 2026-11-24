import { z } from "zod";

import type { BitcoinLegacyAccountAddress } from "./BitcoinLegacyAccountAddress.js";
import { BitcoinLegacyAccountAddressSchema } from "./BitcoinLegacyAccountAddress.js";
import type { BitcoinScriptHashAddress } from "./BitcoinScriptHashAddress.js";
import { BitcoinScriptHashAddressSchema } from "./BitcoinScriptHashAddress.js";
import type { BitcoinSegwitAccountAddress } from "./BitcoinSegwitAccountAddress.js";
import { BitcoinSegwitAccountAddressSchema } from "./BitcoinSegwitAccountAddress.js";
import type { BitcoinSegwitScriptAddress } from "./BitcoinSegwitScriptAddress.js";
import { BitcoinSegwitScriptAddressSchema } from "./BitcoinSegwitScriptAddress.js";
import type { BitcoinTaprootAccountAddress } from "./BitcoinTaprootAccountAddress.js";
import { BitcoinTaprootAccountAddressSchema } from "./BitcoinTaprootAccountAddress.js";

/**
 * Any standard Bitcoin address, mainnet or testnet: P2PKH, P2SH, P2WPKH,
 * P2WSH, or P2TR. Network-agnostic; check it against a {@link BitcoinChainId}
 * at the point of use.
 *
 * Example: `"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"` | `"bc1p…"` | `"1…"` | `"3…"`
 */
export type BitcoinAddress =
  | BitcoinSegwitAccountAddress
  | BitcoinTaprootAccountAddress
  | BitcoinSegwitScriptAddress
  | BitcoinLegacyAccountAddress
  | BitcoinScriptHashAddress;

/** Zod schema: any standard Bitcoin address, branded by its type; bech32 lowercased. */
export const BitcoinAddressSchema = /* @__PURE__ */ z.union([
  BitcoinSegwitAccountAddressSchema,
  BitcoinTaprootAccountAddressSchema,
  BitcoinSegwitScriptAddressSchema,
  BitcoinLegacyAccountAddressSchema,
  BitcoinScriptHashAddressSchema,
]);

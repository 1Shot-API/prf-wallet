import { address, type Address } from "@solana/addresses";

import type { SolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import { SolanaAccountAddress as makeSolanaAccountAddress } from "../primitives/SolanaAccountAddress.js";
import type { SolanaATAAddress } from "../primitives/SolanaATAAddress.js";
import { SolanaATAAddress as makeSolanaATAAddress } from "../primitives/SolanaATAAddress.js";
import type { SolanaMintAddress } from "../primitives/SolanaMintAddress.js";
import { SolanaMintAddress as makeSolanaMintAddress } from "../primitives/SolanaMintAddress.js";
import type { SolanaProgramAddress } from "../primitives/SolanaProgramAddress.js";
import { SolanaProgramAddress as makeSolanaProgramAddress } from "../primitives/SolanaProgramAddress.js";

/**
 * Coerce any OWS Solana address brand (or raw base58) to Kit {@link Address}.
 * Re-validates via `@solana/addresses` so invalid strings throw at the boundary.
 */
export class SolanaAddressUtils {
  static toKitAddress(
    value:
      | SolanaAccountAddress
      | SolanaProgramAddress
      | SolanaMintAddress
      | SolanaATAAddress
      | string,
  ): Address {
    return address(typeof value === "string" ? value : String(value));
  }

  static asAccountAddress(value: Address | string): SolanaAccountAddress {
    return makeSolanaAccountAddress(address(String(value)) as string);
  }

  static asProgramAddress(value: Address | string): SolanaProgramAddress {
    return makeSolanaProgramAddress(address(String(value)) as string);
  }

  static asMintAddress(value: Address | string): SolanaMintAddress {
    return makeSolanaMintAddress(address(String(value)) as string);
  }

  static asAtaAddress(value: Address | string): SolanaATAAddress {
    return makeSolanaATAAddress(address(String(value)) as string);
  }
}

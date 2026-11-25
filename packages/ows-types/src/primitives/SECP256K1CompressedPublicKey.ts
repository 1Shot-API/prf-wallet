import { type Brand, make } from "ts-brand";
import { z } from "zod";

/**
 * Hex-encoded **compressed** secp256k1 public key (`0x02` / `0x03` ‖ X = 33 bytes).
 * Derived from {@link SECP256K1PublicKey}; used for Bitcoin P2WPKH scripts and
 * PSBT partial signatures.
 *
 * Example: `"0x02" + 64 hex characters`
 */
export type SECP256K1CompressedPublicKey = Brand<
  `0x${string}`,
  "SECP256K1CompressedPublicKey"
>;
export const SECP256K1CompressedPublicKey = make<SECP256K1CompressedPublicKey>();

/** Zod schema: compressed secp256k1 public key (`0x02` / `0x03` + 32 bytes). */
export const SECP256K1CompressedPublicKeySchema = /* @__PURE__ */ z
  .string()
  .regex(/^0x0[23][0-9a-fA-F]{64}$/, {
    message: "must be compressed secp256k1 public key (0x02/0x03 + 32 bytes)",
  })
  .transform((s) =>
    SECP256K1CompressedPublicKey(s.toLowerCase() as `0x${string}`),
  );

import { type Brand, make } from "ts-brand";

/**
 * A hex-encoded ECDSA signature (EIP-191, EIP-712, etc.).
 * Example: "0x" + 65-byte secp256k1 signature as 130 hex chars.
 */
export type EVMSignatureHex = Brand<`0x${string}`, "EVMSignatureHex">;
export const EVMSignatureHex = make<EVMSignatureHex>();

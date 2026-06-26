import { to0xHex } from "../hex.js";
import { signAsync as edSignAsync } from "./vendor/noble-ed25519.js";
import { signAsync as secpSignAsync } from "./vendor/noble-secp256k1.js";

/**
 * @param {import('../constants.js').SignScheme} scheme
 * @param {Uint8Array} digest
 * @param {Uint8Array} secp256k1PrivateKey
 * @param {Uint8Array} ed25519Seed
 * @returns {Promise<`0x${string}`>}
 */
export async function signWithScheme(
  scheme,
  digest,
  secp256k1PrivateKey,
  ed25519Seed,
) {
  switch (scheme) {
    case "secp256k1-ecdsa": {
      const sig = await secpSignAsync(digest, secp256k1PrivateKey, {
        lowS: true,
      });
      return to0xHex(sig.toCompactRawBytes());
    }
    case "secp256k1-ecdsa-recoverable": {
      const sig = await secpSignAsync(digest, secp256k1PrivateKey, {
        lowS: true,
      });
      const compact = sig.toCompactRawBytes();
      const recovery = sig.recovery ?? 0;
      const out = new Uint8Array(65);
      out.set(compact, 0);
      out[64] = recovery;
      return to0xHex(out);
    }
    case "secp256k1-bip340":
      throw new Error("schemeNotImplemented");
    case "ed25519": {
      const sig = await edSignAsync(digest, ed25519Seed);
      return to0xHex(sig);
    }
    default:
      throw new Error("unknownScheme");
  }
}

/**
 * @param {import('../constants.js').SignScheme} scheme
 * @param {Uint8Array} payload
 */
export function validateSignPayload(scheme, payload) {
  if (scheme === "ed25519") {
    if (payload.length === 0) throw new Error("invalidPayload");
    return;
  }
  if (payload.length !== 32) {
    throw new Error("digestMustBe32Bytes");
  }
}

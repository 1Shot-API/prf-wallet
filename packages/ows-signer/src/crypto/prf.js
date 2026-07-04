import { PRF_LABEL_ED25519, PRF_LABEL_SECP256K1 } from "../constants.js";
import { getPublicKeyAsync as edGetPublicKeyAsync } from "./vendor/noble-ed25519.js";
import { getPublicKey as secpGetPublicKey } from "./vendor/noble-secp256k1.js";

const SECP256K1_N = BigInt(
  "0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141",
);

/**
 * @param {unknown} prfOutput
 * @returns {ArrayBuffer | null}
 */
export function normalizePrfOutputToArrayBuffer(prfOutput) {
  if (prfOutput instanceof ArrayBuffer) return prfOutput;
  if (prfOutput instanceof Uint8Array) {
    return prfOutput.buffer.slice(
      prfOutput.byteOffset,
      prfOutput.byteOffset + prfOutput.byteLength,
    );
  }
  if (ArrayBuffer.isView(prfOutput)) {
    const view = /** @type {ArrayBufferView} */ (prfOutput);
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    );
  }
  if (Array.isArray(prfOutput)) {
    return new Uint8Array(prfOutput).buffer;
  }
  return null;
}

/**
 * @param {ArrayBuffer} prfBuffer
 * @param {Uint8Array} infoLabel
 * @param {number} length
 * @returns {Promise<Uint8Array>}
 */
export async function hkdfExpand(prfBuffer, infoLabel, length) {
  const ikm = new Uint8Array(prfBuffer);
  const baseKey = await crypto.subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveBits",
  ]);
  const salt = new Uint8Array(32);
  const bits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt,
      info: infoLabel,
    },
    baseKey,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * @param {ArrayBuffer} prfBuffer
 * @param {Uint8Array} infoLabel
 * @returns {Promise<Uint8Array>}
 */
export async function deriveScalarFromPrf(prfBuffer, infoLabel) {
  for (let counter = 0; counter < 255; counter++) {
    const info = new Uint8Array(infoLabel.length + 1);
    info.set(infoLabel);
    info[infoLabel.length] = counter;
    const candidate = await hkdfExpand(prfBuffer, info, 32);
    const scalar = bytesToBigInt(candidate);
    if (scalar > 0n && scalar < SECP256K1_N) {
      return candidate;
    }
  }
  throw new Error("Failed to derive valid secp256k1 scalar from PRF");
}

/**
 * @param {ArrayBuffer} prfBuffer
 * @returns {Promise<Uint8Array>}
 */
export async function deriveEd25519SeedFromPrf(prfBuffer) {
  return hkdfExpand(prfBuffer, PRF_LABEL_ED25519, 32);
}

/**
 * @param {PublicKeyCredential} credential
 * @returns {Promise<{ secp256k1PrivateKey: Uint8Array, secp256k1PublicKey: Uint8Array, ed25519PublicKey: Uint8Array }>}
 */
export async function deriveKeysFromCredential(credential) {
  const rawPrf = /** @type {{ prf?: { results?: { first?: unknown } } }} */ (
    credential.getClientExtensionResults()
  ).prf?.results?.first;
  const prfBuffer = normalizePrfOutputToArrayBuffer(rawPrf);
  if (!prfBuffer) {
    throw new Error("Passkey does not support PRF or PRF output missing");
  }

  const secp256k1PrivateKey = await deriveScalarFromPrf(
    prfBuffer,
    PRF_LABEL_SECP256K1,
  );
  const ed25519Seed = await deriveEd25519SeedFromPrf(prfBuffer);
  // Uncompressed (0x04 ‖ X ‖ Y) — required by viem `publicKeyToAddress`.
  const secp256k1PublicKey = secpGetPublicKey(secp256k1PrivateKey, false);
  const ed25519PublicKey = await edGetPublicKeyAsync(ed25519Seed);

  return { secp256k1PrivateKey, secp256k1PublicKey, ed25519PublicKey };
}

/**
 * @param {Uint8Array} bytes
 * @returns {bigint}
 */
function bytesToBigInt(bytes) {
  let result = 0n;
  for (const b of bytes) result = (result << 8n) + BigInt(b);
  return result;
}

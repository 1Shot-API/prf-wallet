import { PRF_LABEL_AES256 } from "../constants.js";
import { parse0xHex, to0xHex } from "../hex.js";
import { hkdfExpand } from "./prf.js";

/** Envelope prefix — distinct from recovery `ows1:` (PBKDF2). */
export const AES256_ENVELOPE_PREFIX = "ows-aes1:";
const AES256_VERSION = 1;
const IV_LENGTH = 12;

/**
 * Derive an AES-256-GCM CryptoKey from the wallet secp256k1 scalar
 * (same material `signDigest` uses), via HKDF domain separation.
 *
 * @param {Uint8Array} secp256k1PrivateKey
 * @returns {Promise<CryptoKey>}
 */
export async function deriveAes256KeyFromSecp256k1(secp256k1PrivateKey) {
  const raw = await hkdfExpand(
    secp256k1PrivateKey.buffer.slice(
      secp256k1PrivateKey.byteOffset,
      secp256k1PrivateKey.byteOffset + secp256k1PrivateKey.byteLength,
    ),
    PRF_LABEL_AES256,
    32,
  );
  try {
    return await crypto.subtle.importKey(
      "raw",
      raw,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } finally {
    raw.fill(0);
  }
}

/**
 * Encrypt a UTF-8 plaintext. Envelope: `ows-aes1:0x` ‖ version ‖ IV ‖ ciphertext+tag.
 *
 * @param {string} plaintext
 * @param {CryptoKey} aesKey
 * @returns {Promise<string>}
 */
export async function encryptAes256String(plaintext, aesKey) {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, encoded),
  );
  const payload = new Uint8Array(1 + IV_LENGTH + ciphertext.length);
  payload[0] = AES256_VERSION;
  payload.set(iv, 1);
  payload.set(ciphertext, 1 + IV_LENGTH);
  return `${AES256_ENVELOPE_PREFIX}${to0xHex(payload)}`;
}

/**
 * Decrypt an `ows-aes1:` envelope to a UTF-8 string.
 *
 * @param {string} envelope
 * @param {CryptoKey} aesKey
 * @returns {Promise<string>}
 */
export async function decryptAes256String(envelope, aesKey) {
  if (!envelope.startsWith(AES256_ENVELOPE_PREFIX)) {
    throw new Error("invalidAes256Envelope");
  }
  const bytes = parse0xHex(envelope.slice(AES256_ENVELOPE_PREFIX.length));
  if (bytes.length < 1 + IV_LENGTH + 16) {
    throw new Error("invalidAes256Envelope");
  }
  if (bytes[0] !== AES256_VERSION) {
    throw new Error("unsupportedAes256Version");
  }
  const iv = bytes.slice(1, 1 + IV_LENGTH);
  const ciphertext = bytes.slice(1 + IV_LENGTH);
  try {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new Error("decryptionFailed");
  }
}

/**
 * @param {string[]} plaintexts
 * @param {Uint8Array} secp256k1PrivateKey
 * @returns {Promise<string[]>}
 */
export async function encryptAes256Batch(plaintexts, secp256k1PrivateKey) {
  const aesKey = await deriveAes256KeyFromSecp256k1(secp256k1PrivateKey);
  const out = [];
  for (const plaintext of plaintexts) {
    out.push(await encryptAes256String(plaintext, aesKey));
  }
  return out;
}

/**
 * @param {string[]} envelopes
 * @param {Uint8Array} secp256k1PrivateKey
 * @returns {Promise<string[]>}
 */
export async function decryptAes256Batch(envelopes, secp256k1PrivateKey) {
  const aesKey = await deriveAes256KeyFromSecp256k1(secp256k1PrivateKey);
  const out = [];
  for (const envelope of envelopes) {
    out.push(await decryptAes256String(envelope, aesKey));
  }
  return out;
}

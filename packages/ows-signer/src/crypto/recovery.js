import { parse0xHex, to0xHex } from "../hex.js";

const RECOVERY_VERSION = 1;
const PBKDF2_ITERATIONS = 250_000;

/**
 * @param {string} passphrase
 * @param {Uint8Array} salt
 * @returns {Promise<CryptoKey>}
 */
async function deriveAesKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/**
 * @param {Uint8Array} privateKey
 * @param {string} passphrase
 * @returns {Promise<string>}
 */
export async function encryptPrivateKey(privateKey, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const aesKey = await deriveAesKey(passphrase, salt);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aesKey, privateKey),
  );
  const payload = new Uint8Array(
    1 + salt.length + iv.length + ciphertext.length,
  );
  payload[0] = RECOVERY_VERSION;
  payload.set(salt, 1);
  payload.set(iv, 1 + salt.length);
  payload.set(ciphertext, 1 + salt.length + iv.length);
  return `ows1:${to0xHex(payload)}`;
}

/**
 * @param {string} envelope
 * @returns {Promise<Uint8Array>}
 */
export async function decryptPrivateKey(envelope, passphrase) {
  if (!envelope.startsWith("ows1:")) {
    throw new Error("invalidRecoveryEnvelope");
  }
  const bytes = parse0xHex(envelope.slice(5));
  if (bytes[0] !== RECOVERY_VERSION) {
    throw new Error("unsupportedRecoveryVersion");
  }
  const salt = bytes.slice(1, 17);
  const iv = bytes.slice(17, 29);
  const ciphertext = bytes.slice(29);
  const aesKey = await deriveAesKey(passphrase, salt);
  try {
    const plain = new Uint8Array(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv }, aesKey, ciphertext),
    );
    if (plain.length !== 32) throw new Error("invalidDecryptedKey");
    return plain;
  } catch {
    throw new Error("decryptionFailed");
  }
}

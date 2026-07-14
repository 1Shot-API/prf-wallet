/** @typedef {'secp256k1-ecdsa' | 'secp256k1-ecdsa-recoverable' | 'secp256k1-bip340' | 'ed25519'} SignScheme */

export const API_VERSION = 1;
export const SIGNER_VERSION = "0.1.0";

export const PRF_LABEL_SECP256K1 = new TextEncoder().encode("ows-v1/secp256k1");
export const PRF_LABEL_ED25519 = new TextEncoder().encode("ows-v1/ed25519");
/** HKDF info for AES-256-GCM — IKM is the secp256k1 scalar (`signDigest` material). */
export const PRF_LABEL_AES256 = new TextEncoder().encode("ows-v1/aes256-gcm");

/** @type {SignScheme[]} */
export const SIGN_SCHEMES = [
  "secp256k1-ecdsa",
  "secp256k1-ecdsa-recoverable",
  "secp256k1-bip340",
  "ed25519",
];

export const METHODS = [
  "getVersion",
  "createCredential",
  "signDigest",
  "revealPrivateKey",
  "createRecoveryData",
  "recoverKey",
  "getPublicKey",
  "clearRecoverySession",
  "encryptAES256",
  "decryptAES256",
];

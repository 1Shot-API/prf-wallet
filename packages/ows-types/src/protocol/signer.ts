import type { COSEPublicKey } from "../primitives/COSEPublicKey.js";
import type { ED25519PublicKey } from "../primitives/ED25519PublicKey.js";
import type { SECP256K1PublicKey } from "../primitives/SECP256K1PublicKey.js";

export const API_VERSION = 1 as const;

export type SignScheme =
  | "secp256k1-ecdsa"
  | "secp256k1-ecdsa-recoverable"
  | "secp256k1-bip340"
  | "ed25519";

export type SignerMethod =
  | "getVersion"
  | "createCredential"
  | "signDigest"
  | "revealPrivateKey"
  | "createRecoveryData"
  | "recoverKey"
  | "getPublicKey"
  | "clearRecoverySession"
  | "encryptAES256"
  | "decryptAES256";

export type SignerEvent =
  | "Version"
  | "KeyDerived"
  | "CredentialCreated"
  | "DigestSigned"
  | "RecoveryDataCreated"
  | "RecoverySessionStarted"
  | "RecoverySessionCleared"
  | "PublicKey"
  | "ChallengeSigned"
  | "AES256Encrypted"
  | "AES256Decrypted"
  | "NotAllowed"
  | "InvalidRequest";

export type SignerRequest = {
  v: typeof API_VERSION;
  kind: "request";
  method: SignerMethod;
  correlationId?: string;
  params?: Record<string, unknown>;
};

export type SignerEventMessage = {
  v: typeof API_VERSION;
  kind: "event";
  event: SignerEvent;
  correlationId?: string;
  data: Record<string, unknown>;
};

export type VersionData = {
  apiVersion: number;
  signerVersion: string;
  recoverySessionActive: boolean;
};

export type KeyDerivedData = {
  secp256k1PublicKey: SECP256K1PublicKey;
  ed25519PublicKey: ED25519PublicKey;
};

export type CredentialCreatedData = {
  credentialId: string;
  /** Authenticator COSE public key; only available on create (attestation). */
  cosePublicKey: COSEPublicKey | null;
  secp256k1PublicKey: SECP256K1PublicKey;
};

export type DigestSignedData = {
  digest: `0x${string}`;
  scheme: SignScheme;
  signature: `0x${string}`;
  credentialId: string | null;
};

export type RecoveryDataCreatedData = {
  encryptedPrivateKey: string;
};

export type RecoverySessionStartedData = {
  recoverySessionActive: true;
};

export type RecoverySessionClearedData = {
  rebound?: boolean;
};

export type PublicKeyData = {
  /**
   * Authenticator COSE public key when available (create/attestation only).
   * Assertions do not include credentialPublicKey — typically `null` here.
   */
  cosePublicKey: COSEPublicKey | null;
  secp256k1PublicKey: SECP256K1PublicKey;
  ed25519PublicKey: ED25519PublicKey;
  credentialId?: string;
};

export type ChallengeSignedData = {
  challenge: `0x${string}`;
  signature: string;
};

export type CreateCredentialOptions = {
  rpName?: string;
  userDisplayName?: string;
  userId?: string;
};

export type GetPublicKeyParams = {
  credentialId?: string;
  challenge?: `0x${string}`;
  /** When true, use discoverable credentials (omit allowCredentials). */
  discoverable?: boolean;
};

/**
 * Batch encrypt plaintexts with PRF-derived AES-256-GCM
 * (HKDF from the wallet secp256k1 scalar — same material as `signDigest`).
 * Arrays amortize a single passkey ceremony across multiple plaintexts.
 */
export type EncryptAES256Params = {
  plaintexts: string[];
  credentialId?: string;
};

export type EncryptAES256Result = {
  ciphertexts: string[];
};

/**
 * Batch decrypt AES-256-GCM envelopes (`ows-aes1:…`).
 */
export type DecryptAES256Params = {
  ciphertexts: string[];
  credentialId?: string;
};

export type DecryptAES256Result = {
  plaintexts: string[];
};

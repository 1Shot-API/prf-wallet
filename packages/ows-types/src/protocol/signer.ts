import type { ED25519PublicKey } from "../primitives/ED25519PublicKey.js";
import type { PasskeyPublicKey } from "../primitives/PasskeyPublicKey.js";
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
  | "clearRecoverySession";

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
  passkeyPublicKey: PasskeyPublicKey | null;
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
  passkeyPublicKey: PasskeyPublicKey | null;
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

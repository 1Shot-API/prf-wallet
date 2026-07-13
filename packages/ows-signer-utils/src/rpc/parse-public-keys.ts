import {
  ED25519PublicKey,
  PasskeyPublicKey,
  SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import type {
  CredentialCreatedData,
  KeyDerivedData,
  PublicKeyData,
} from "./types.js";

function parsePasskeyPublicKey(value: unknown): PasskeyPublicKey | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string") {
    return PasskeyPublicKey(value);
  }
  return null;
}

function parseSecp256k1PublicKey(value: unknown): SECP256K1PublicKey | null {
  if (typeof value === "string" && value.startsWith("0x")) {
    return SECP256K1PublicKey(value as `0x${string}`);
  }
  return null;
}

function parseEd25519PublicKey(value: unknown): ED25519PublicKey | null {
  if (typeof value === "string" && value.startsWith("0x")) {
    return ED25519PublicKey(value as `0x${string}`);
  }
  return null;
}

export function keyDerivedDataFromEvent(
  data: Record<string, unknown>,
): KeyDerivedData | null {
  const secp256k1PublicKey = parseSecp256k1PublicKey(data.secp256k1PublicKey);
  const ed25519PublicKey = parseEd25519PublicKey(data.ed25519PublicKey);
  if (!secp256k1PublicKey || !ed25519PublicKey) {
    return null;
  }
  return { secp256k1PublicKey, ed25519PublicKey };
}

export function publicKeyDataFromEvent(
  data: Record<string, unknown>,
): PublicKeyData | null {
  const secp256k1PublicKey = parseSecp256k1PublicKey(data.secp256k1PublicKey);
  const ed25519PublicKey = parseEd25519PublicKey(data.ed25519PublicKey);
  if (!secp256k1PublicKey || !ed25519PublicKey) {
    return null;
  }
  return {
    passkeyPublicKey: parsePasskeyPublicKey(data.passkeyPublicKey),
    secp256k1PublicKey,
    ed25519PublicKey,
  };
}

export function credentialCreatedDataFromEvent(
  data: Record<string, unknown>,
): CredentialCreatedData | null {
  if (typeof data.credentialId !== "string") {
    return null;
  }
  const secp256k1PublicKey = parseSecp256k1PublicKey(data.secp256k1PublicKey);
  if (!secp256k1PublicKey) {
    return null;
  }
  return {
    credentialId: data.credentialId,
    passkeyPublicKey: parsePasskeyPublicKey(data.passkeyPublicKey),
    secp256k1PublicKey,
  };
}

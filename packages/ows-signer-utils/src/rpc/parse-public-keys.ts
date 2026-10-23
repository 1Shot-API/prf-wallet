import {
  COSEPublicKeySchema,
  CredentialIdSchema,
  ED25519PublicKeySchema,
  SECP256K1PublicKeySchema,
  type COSEPublicKey,
  type CredentialId,
  type ED25519PublicKey,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import type {
  CredentialCreatedData,
  KeyDerivedData,
  PublicKeyData,
} from "@1shotapi/ows-types";

function parseCosePublicKey(value: unknown): COSEPublicKey | null {
  const parsed = COSEPublicKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseSecp256k1PublicKey(value: unknown): SECP256K1PublicKey | null {
  const parsed = SECP256K1PublicKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseEd25519PublicKey(value: unknown): ED25519PublicKey | null {
  const parsed = ED25519PublicKeySchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function parseCredentialId(value: unknown): CredentialId | undefined {
  const parsed = CredentialIdSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
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
    cosePublicKey: parseCosePublicKey(data.cosePublicKey),
    secp256k1PublicKey,
    ed25519PublicKey,
    credentialId: parseCredentialId(data.credentialId),
  };
}

export function credentialCreatedDataFromEvent(
  data: Record<string, unknown>,
): CredentialCreatedData | null {
  const credentialId = parseCredentialId(data.credentialId);
  if (!credentialId) {
    return null;
  }
  const secp256k1PublicKey = parseSecp256k1PublicKey(data.secp256k1PublicKey);
  return {
    credentialId,
    cosePublicKey: parseCosePublicKey(data.cosePublicKey),
    ...(secp256k1PublicKey ? { secp256k1PublicKey } : {}),
  };
}

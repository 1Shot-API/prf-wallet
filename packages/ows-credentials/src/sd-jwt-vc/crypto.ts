import { Base64UrlEncodedString } from "@1shotapi/ows-types";
import type { Hasher, SaltGenerator } from "@sd-jwt/core";

export function bytesToBase64Url(bytes: Uint8Array): Base64UrlEncodedString {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return Base64UrlEncodedString(
    btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  );
}

export function base64UrlToBytes(value: Base64UrlEncodedString): Uint8Array {
  const padded = value + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toHashBytes(data: string | ArrayBuffer): Uint8Array {
  return typeof data === "string"
    ? new TextEncoder().encode(data)
    : new Uint8Array(data);
}

/** Web Crypto expects BufferSource backed by ArrayBuffer, not ArrayBufferLike. */
function asBufferSource(bytes: Uint8Array): BufferSource {
  return new Uint8Array(bytes);
}

/** SHA-256 hasher for SD-JWT (@sd-jwt/core `Hasher` contract). Uses Web Crypto. */
export const sdJwtHasher: Hasher = async (data, alg) => {
  if (!alg.includes("sha-256")) {
    throw new Error(`sdJwtHasher: unsupported algorithm ${alg}`);
  }
  const digest = await crypto.subtle.digest("SHA-256", asBufferSource(toHashBytes(data)));
  return new Uint8Array(digest);
};

/** Random salt generator for SD-JWT disclosures. Uses Web Crypto. */
export const sdJwtSaltGenerator: SaltGenerator = async (length) => {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
};

export async function importEd25519PrivateKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["sign"]);
}

export async function importEd25519PublicKey(jwk: JsonWebKey): Promise<CryptoKey> {
  return crypto.subtle.importKey("jwk", jwk, { name: "Ed25519" }, false, ["verify"]);
}

export async function signEd25519(
  privateJwk: JsonWebKey,
  data: string,
): Promise<Base64UrlEncodedString> {
  const key = await importEd25519PrivateKey(privateJwk);
  const signature = await crypto.subtle.sign(
    "Ed25519",
    key,
    asBufferSource(new TextEncoder().encode(data)),
  );
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function verifyEd25519(
  publicJwk: JsonWebKey,
  data: string,
  signatureBase64Url: Base64UrlEncodedString,
): Promise<boolean> {
  const key = await importEd25519PublicKey(publicJwk);
  return crypto.subtle.verify(
    "Ed25519",
    key,
    asBufferSource(base64UrlToBytes(signatureBase64Url)),
    asBufferSource(new TextEncoder().encode(data)),
  );
}

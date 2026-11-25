/**
 * @param {string} hex - with or without `0x` prefix
 * @returns {Uint8Array}
 */
export function hexToBytes(hex) {
  if (hex.startsWith("0x") || hex.startsWith("0X")) {
    hex = hex.slice(2);
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/**
 * @param {unknown} value
 * @param {number} [expectedBytes]
 * @returns {Uint8Array}
 */
export function parse0xHex(value, expectedBytes) {
  if (typeof value !== "string" || !value.startsWith("0x")) {
    throw new Error("Expected 0x-prefixed hex string");
  }
  const hex = value.slice(2);
  if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Invalid hex string");
  }
  const bytes = hexToBytes(hex);
  if (expectedBytes !== undefined && bytes.length !== expectedBytes) {
    throw new Error(`Expected ${expectedBytes} bytes, got ${bytes.length}`);
  }
  return bytes;
}

/**
 * @param {Uint8Array} bytes
 * @returns {`0x${string}`}
 */
export function to0xHex(bytes) {
  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

/**
 * @param {ArrayBuffer | Uint8Array} buffer
 * @returns {string}
 */
export function bufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * @param {string} value
 * @returns {Uint8Array}
 */
export function base64UrlToBytes(value) {
  const pad = "=".repeat((4 - (value.length % 4)) % 4);
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

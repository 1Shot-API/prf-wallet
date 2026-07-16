import assert from "node:assert/strict";
import { createPublicKey, generateKeyPairSync } from "node:crypto";
import { describe, it } from "node:test";
import {
  Base64UrlEncodedString,
  ConversionUtils,
  COSEPublicKey,
} from "@1shotapi/ows-types";
import { COSEToSPKIPublicKey } from "../src/webauthn/cose-to-spki.js";

const COSEKEYS = {
  kty: 1,
  alg: 3,
  crv: -1,
  x: -2,
  y: -3,
} as const;

describe("COSEToSPKIPublicKey", () => {
  it("converts EC2 P-256 COSE to SPKI that Node can import", () => {
    const { publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
    const jwk = publicKey.export({ format: "jwk" });
    assert.equal(jwk.kty, "EC");
    assert.ok(jwk.x && jwk.y);

    const x = ConversionUtils.base64UrlToBytes(
      Base64UrlEncodedString(jwk.x),
    );
    const y = ConversionUtils.base64UrlToBytes(
      Base64UrlEncodedString(jwk.y),
    );

    const map = new Map<number, number | Uint8Array>();
    map.set(COSEKEYS.kty, 2);
    map.set(COSEKEYS.alg, -7);
    map.set(COSEKEYS.crv, 1);
    map.set(COSEKEYS.x, x);
    map.set(COSEKEYS.y, y);
    const cose = COSEPublicKey(
      ConversionUtils.bytesToBase64Url(encodeCborMap(map)),
    );

    const spki = COSEToSPKIPublicKey(cose);
    const imported = createPublicKey({
      key: Buffer.from(
        ConversionUtils.base64UrlToBytes(Base64UrlEncodedString(String(spki))),
      ),
      format: "der",
      type: "spki",
    });
    const roundTrip = imported.export({ format: "jwk" });
    assert.equal(roundTrip.x, jwk.x);
    assert.equal(roundTrip.y, jwk.y);
    assert.equal(roundTrip.crv, "P-256");
  });
});

/** Minimal definite-length CBOR map encoder for integer keys / mixed values. */
function encodeCborMap(map: Map<number, number | Uint8Array>): Uint8Array {
  const parts: Uint8Array[] = [];
  parts.push(encodeCborUint(5, map.size)); // major 5 = map
  for (const [key, value] of map) {
    parts.push(encodeCborInt(key));
    if (typeof value === "number") {
      parts.push(encodeCborInt(value));
    } else {
      parts.push(encodeCborBytes(value));
    }
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function encodeCborUint(major: number, value: number): Uint8Array {
  if (value < 24) return new Uint8Array([(major << 5) | value]);
  if (value < 256) return new Uint8Array([(major << 5) | 24, value]);
  if (value < 65536) {
    return new Uint8Array([(major << 5) | 25, value >> 8, value & 0xff]);
  }
  throw new Error("cbor uint too large");
}

function encodeCborInt(value: number): Uint8Array {
  if (value >= 0) return encodeCborUint(0, value);
  return encodeCborUint(1, -1 - value);
}

function encodeCborBytes(bytes: Uint8Array): Uint8Array {
  const header = encodeCborUint(2, bytes.length);
  const out = new Uint8Array(header.length + bytes.length);
  out.set(header, 0);
  out.set(bytes, header.length);
  return out;
}

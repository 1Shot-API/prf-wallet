import {
  Base64UrlEncodedString,
  ConversionUtils,
  COSEPublicKey,
  HexString,
  SPKIPublicKey,
} from "@1shotapi/ows-types";

/** COSE key common / type params (IANA). */
const COSEKEYS = {
  kty: 1,
  alg: 3,
  crv: -1,
  x: -2,
  y: -3,
} as const;

const COSEKTY = {
  OKP: 1,
  EC2: 2,
} as const;

const COSECRV = {
  P256: 1,
  P384: 2,
  P521: 3,
  ED25519: 6,
} as const;

/** Fixed SPKI SubjectPublicKeyInfo headers (OID + BIT STRING wrapper). */
const SPKI_P256_PREFIX = ConversionUtils.hexToBytes(
  HexString("0x3059301306072a8648ce3d020106082a8648ce3d030107034200"),
);
const SPKI_P384_PREFIX = ConversionUtils.hexToBytes(
  HexString("0x3076301006072a8648ce3d020106052b81040022036200"),
);
const SPKI_ED25519_PREFIX = ConversionUtils.hexToBytes(
  HexString("0x302a300506032b6570032100"),
);

/**
 * Convert a WebAuthn COSE credential public key to SPKI DER (base64url).
 * Supports EC2 P-256 / P-384 and OKP Ed25519 (typical WebAuthn algs).
 */
export function COSEToSPKIPublicKey(cose: COSEPublicKey): SPKIPublicKey {
  const bytes = ConversionUtils.base64UrlToBytes(
    Base64UrlEncodedString(String(cose)),
  );
  const map = decodeCoseMap(bytes);
  const kty = map.get(COSEKEYS.kty);
  if (typeof kty !== "number") {
    throw new Error("COSE public key missing kty");
  }

  if (kty === COSEKTY.EC2) {
    return ec2ToSpki(map);
  }
  if (kty === COSEKTY.OKP) {
    return okpToSpki(map);
  }
  throw new Error(`unsupported COSE kty: ${kty}`);
}

function ec2ToSpki(map: Map<number, unknown>): SPKIPublicKey {
  const crv = map.get(COSEKEYS.crv);
  const x = ConversionUtils.asUint8Array(map.get(COSEKEYS.x), "COSE public key x");
  const y = ConversionUtils.asUint8Array(map.get(COSEKEYS.y), "COSE public key y");

  let prefix: Uint8Array;
  let coordLen: number;
  if (crv === COSECRV.P256) {
    prefix = SPKI_P256_PREFIX;
    coordLen = 32;
  } else if (crv === COSECRV.P384) {
    prefix = SPKI_P384_PREFIX;
    coordLen = 48;
  } else {
    throw new Error(`unsupported COSE EC2 curve: ${String(crv)}`);
  }
  if (x.length !== coordLen || y.length !== coordLen) {
    throw new Error(
      `COSE EC2 coordinate length mismatch (expected ${coordLen})`,
    );
  }

  const spki = new Uint8Array(prefix.length + 1 + coordLen * 2);
  spki.set(prefix, 0);
  spki[prefix.length] = 0x04; // uncompressed point
  spki.set(x, prefix.length + 1);
  spki.set(y, prefix.length + 1 + coordLen);
  return SPKIPublicKey(ConversionUtils.bytesToBase64Url(spki));
}

function okpToSpki(map: Map<number, unknown>): SPKIPublicKey {
  const crv = map.get(COSEKEYS.crv);
  if (crv !== COSECRV.ED25519) {
    throw new Error(`unsupported COSE OKP curve: ${String(crv)}`);
  }
  const x = ConversionUtils.asUint8Array(map.get(COSEKEYS.x), "COSE public key x");
  if (x.length !== 32) {
    throw new Error("Ed25519 COSE x must be 32 bytes");
  }
  const spki = new Uint8Array(SPKI_ED25519_PREFIX.length + x.length);
  spki.set(SPKI_ED25519_PREFIX, 0);
  spki.set(x, SPKI_ED25519_PREFIX.length);
  return SPKIPublicKey(ConversionUtils.bytesToBase64Url(spki));
}

/**
 * Decode a COSE key CBOR map (definite-length, integer keys).
 */
function decodeCoseMap(bytes: Uint8Array): Map<number, unknown> {
  const decoded = decodeCborFirst(bytes);
  if (!(decoded instanceof Map)) {
    throw new Error("COSE public key is not a CBOR map");
  }
  return decoded as Map<number, unknown>;
}

function decodeCborFirst(buf: Uint8Array, offset = 0): unknown {
  if (offset >= buf.length) throw new Error("cborTruncated");
  const initial = buf[offset]!;
  const major = initial >> 5;
  const additional = initial & 31;
  let pos = offset + 1;
  let argument = additional;

  if (additional === 24) {
    argument = buf[pos]!;
    pos += 1;
  } else if (additional === 25) {
    argument = (buf[pos]! << 8) | buf[pos + 1]!;
    pos += 2;
  } else if (additional === 26) {
    argument =
      ((buf[pos]! << 24) |
        (buf[pos + 1]! << 16) |
        (buf[pos + 2]! << 8) |
        buf[pos + 3]!) >>>
      0;
    pos += 4;
  } else if (additional >= 27) {
    throw new Error("cborLengthUnsupported");
  }

  if (major === 0) return argument;
  if (major === 1) return -1 - argument;
  if (major === 2) {
    const end = pos + argument;
    return buf.subarray(pos, end);
  }
  if (major === 3) {
    const end = pos + argument;
    return new TextDecoder().decode(buf.subarray(pos, end));
  }
  if (major === 4) {
    const arr: unknown[] = [];
    let cursor = pos;
    for (let i = 0; i < argument; i++) {
      const [value, next] = decodeCborItem(buf, cursor);
      arr.push(value);
      cursor = next;
    }
    return arr;
  }
  if (major === 5) {
    const map = new Map<unknown, unknown>();
    let cursor = pos;
    for (let i = 0; i < argument; i++) {
      const [key, afterKey] = decodeCborItem(buf, cursor);
      const [value, afterValue] = decodeCborItem(buf, afterKey);
      map.set(key, value);
      cursor = afterValue;
    }
    return map;
  }
  if (major === 7) {
    if (additional === 20) return false;
    if (additional === 21) return true;
    if (additional === 22) return null;
    throw new Error("cborSimpleUnsupported");
  }
  throw new Error(`cborUnsupportedMajor:${major}`);
}

function decodeCborItem(
  buf: Uint8Array,
  offset: number,
): [unknown, number] {
  const value = decodeCborFirst(buf, offset);
  const length = cborFirstItemLength(buf, offset);
  return [value, offset + length];
}

function cborFirstItemLength(buf: Uint8Array, offset: number): number {
  if (offset >= buf.length) throw new Error("cborTruncated");
  const initial = buf[offset]!;
  const major = initial >> 5;
  const additional = initial & 31;
  let pos = offset + 1;
  let argument = additional;

  if (additional === 24) {
    argument = buf[pos]!;
    pos += 1;
  } else if (additional === 25) {
    argument = (buf[pos]! << 8) | buf[pos + 1]!;
    pos += 2;
  } else if (additional === 26) {
    argument =
      ((buf[pos]! << 24) |
        (buf[pos + 1]! << 16) |
        (buf[pos + 2]! << 8) |
        buf[pos + 3]!) >>>
      0;
    pos += 4;
  } else if (additional >= 27) {
    throw new Error("cborLengthUnsupported");
  }

  if (major === 0 || major === 1) return pos - offset;
  if (major === 2 || major === 3) return pos - offset + argument;
  if (major === 7) {
    if (additional < 24) return pos - offset;
    if (additional === 25) return pos - offset + 2;
    if (additional === 26) return pos - offset + 4;
    if (additional === 27) return pos - offset + 8;
    return pos - offset;
  }
  if (major === 6) {
    return pos - offset + cborFirstItemLength(buf, pos);
  }
  if (major === 4 || major === 5) {
    const valueCount = major === 5 ? argument * 2 : argument;
    for (let i = 0; i < valueCount; i++) {
      pos += cborFirstItemLength(buf, pos);
    }
    return pos - offset;
  }
  throw new Error("cborUnsupportedMajor");
}

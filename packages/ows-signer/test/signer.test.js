import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse0xHex, to0xHex, hexToBytes, bufferToBase64Url, base64UrlToBytes } from "../src/hex.js";
import { parseRequest } from "../src/rpc.js";
import { SIGN_SCHEMES, METHODS } from "../src/constants.js";
import { encryptPrivateKey, decryptPrivateKey } from "../src/crypto/recovery.js";
import { validateSignPayload } from "../src/crypto/sign.js";

describe("hex", () => {
  it("round-trips bytes", () => {
    const bytes = new Uint8Array([0, 1, 255]);
    assert.equal(to0xHex(bytes), "0x0001ff");
    assert.deepEqual(parse0xHex("0x0001ff"), bytes);
    assert.deepEqual(hexToBytes("0x0001ff"), bytes);
    assert.deepEqual(hexToBytes("0001ff"), bytes);
  });

  it("base64url round-trips", () => {
    const bytes = new Uint8Array([1, 2, 3, 250]);
    const encoded = bufferToBase64Url(bytes);
    assert.deepEqual(base64UrlToBytes(encoded), bytes);
  });

  it("rejects invalid hex", () => {
    assert.throws(() => parse0xHex("0x0g"));
    assert.throws(() => parse0xHex("abc"));
  });
});

describe("rpc", () => {
  it("parses valid requests", () => {
    assert.equal(
      parseRequest({ v: 1, kind: "request", method: "getVersion" }),
      true,
    );
    assert.equal(parseRequest({ v: 2, kind: "request", method: "x" }), false);
  });
});

describe("constants", () => {
  it("includes expected methods and schemes", () => {
    assert.ok(METHODS.includes("signDigest"));
    assert.ok(METHODS.includes("encryptAES256"));
    assert.ok(METHODS.includes("decryptAES256"));
    assert.ok(SIGN_SCHEMES.includes("secp256k1-ecdsa-recoverable"));
  });
});

describe("recovery", () => {
  it("encrypts and decrypts private key envelope", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    key[31] = 1;
    const envelope = await encryptPrivateKey(key, "test-passphrase-123");
    assert.match(envelope, /^ows1:0x/);
    const decrypted = await decryptPrivateKey(envelope, "test-passphrase-123");
    assert.deepEqual(decrypted, key);
  });

  it("fails on wrong passphrase", async () => {
    const key = crypto.getRandomValues(new Uint8Array(32));
    const envelope = await encryptPrivateKey(key, "correct");
    await assert.rejects(() => decryptPrivateKey(envelope, "wrong"));
  });
});

describe("sign validation", () => {
  it("requires 32-byte digest for secp256k1", () => {
    assert.throws(() =>
      validateSignPayload("secp256k1-ecdsa", new Uint8Array(31)),
    );
    validateSignPayload("secp256k1-ecdsa", new Uint8Array(32));
  });
});

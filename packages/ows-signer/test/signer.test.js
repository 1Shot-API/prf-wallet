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
    assert.ok(METHODS.includes("executeBatch"));
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

describe("aes256", () => {
  it("round-trips batch envelopes from secp256k1 material", async () => {
    const {
      AES256_ENVELOPE_PREFIX,
      decryptAes256Batch,
      encryptAes256Batch,
    } = await import("../src/crypto/aes256.js");
    const secpKey = crypto.getRandomValues(new Uint8Array(32));
    secpKey[31] = 1;
    const plaintexts = ["hello", '{"credential":true}', ""];
    const ciphertexts = await encryptAes256Batch(plaintexts, secpKey);
    assert.equal(ciphertexts.length, 3);
    for (const c of ciphertexts) {
      assert.ok(c.startsWith(AES256_ENVELOPE_PREFIX));
    }
    const decrypted = await decryptAes256Batch(ciphertexts, secpKey);
    assert.deepEqual(decrypted, plaintexts);
  });

  it("fails decrypt with wrong key material", async () => {
    const { decryptAes256Batch, encryptAes256Batch } = await import(
      "../src/crypto/aes256.js"
    );
    const keyA = crypto.getRandomValues(new Uint8Array(32));
    const keyB = crypto.getRandomValues(new Uint8Array(32));
    keyA[31] = 1;
    keyB[31] = 2;
    const [envelope] = await encryptAes256Batch(["secret"], keyA);
    await assert.rejects(() => decryptAes256Batch([envelope], keyB));
  });

  it("rejects invalid envelopes", async () => {
    const { decryptAes256Batch } = await import("../src/crypto/aes256.js");
    const key = crypto.getRandomValues(new Uint8Array(32));
    key[31] = 1;
    await assert.rejects(() =>
      decryptAes256Batch(["ows1:0x010203"], key),
    );
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

describe("sign recoverable", () => {
  it("emits 65-byte signatures with v in {27, 28}", async () => {
    const { signWithScheme } = await import("../src/crypto/sign.js");
    const digest = crypto.getRandomValues(new Uint8Array(32));
    const priv = crypto.getRandomValues(new Uint8Array(32));
    priv[0] %= 0xf0;
    priv[31] |= 1;
    const signature = await signWithScheme(
      "secp256k1-ecdsa-recoverable",
      digest,
      priv,
      new Uint8Array(32),
    );
    assert.match(signature, /^0x[0-9a-f]{130}$/i);
    const v = Number.parseInt(signature.slice(-2), 16);
    assert.ok(v === 27 || v === 28, `expected v 27|28, got ${v}`);
  });

  it("compact scheme stays 64 bytes", async () => {
    const { signWithScheme } = await import("../src/crypto/sign.js");
    const digest = crypto.getRandomValues(new Uint8Array(32));
    const priv = crypto.getRandomValues(new Uint8Array(32));
    priv[0] %= 0xf0;
    priv[31] |= 1;
    const signature = await signWithScheme(
      "secp256k1-ecdsa",
      digest,
      priv,
      new Uint8Array(32),
    );
    assert.match(signature, /^0x[0-9a-f]{128}$/i);
  });
});

describe("ceremony UI", () => {
  it("resolveCeremonyUi applies defaults", async () => {
    const { resolveCeremonyUi, CeremonyDeniedError } = await import(
      "../src/ui.js"
    );
    const defaults = resolveCeremonyUi({});
    assert.equal(defaults.header, "Confirm passkey");
    assert.equal(defaults.confirmButtonText, "Continue");
    assert.equal(defaults.denyButtonText, "Cancel");

    const custom = resolveCeremonyUi({
      explanationHeader: "Unlock",
      explanationText: "Tap continue",
      confirmButtonText: "Go",
      denyButtonText: "No",
    });
    assert.equal(custom.header, "Unlock");
    assert.equal(custom.explanation, "Tap continue");
    assert.equal(custom.confirmButtonText, "Go");
    assert.equal(custom.denyButtonText, "No");

    const err = new CeremonyDeniedError();
    assert.equal(err.name, "CeremonyDeniedError");
  });

  it("sanitizeDisplayText strips HTML and entities", async () => {
    const { sanitizeDisplayText, resolveCeremonyUi } = await import(
      "../src/ui.js"
    );
    assert.equal(
      sanitizeDisplayText('<img src=x onerror="alert(1)">Hello'),
      "Hello",
    );
    assert.equal(
      sanitizeDisplayText("&lt;script&gt;alert(1)&lt;/script&gt;Safe"),
      "alert(1)Safe",
    );
    assert.equal(
      sanitizeDisplayText("line1\nline2", { allowNewlines: true }),
      "line1\nline2",
    );
    assert.equal(sanitizeDisplayText("a\nb", { allowNewlines: false }), "a b");

    const ui = resolveCeremonyUi({
      explanationHeader: "<b>Confirm</b>",
      explanationText: '<a href="javascript:alert(1)">Click</a> please',
      confirmButtonText: "<script>x</script>OK",
      denyButtonText: "No",
    });
    assert.equal(ui.header, "Confirm");
    assert.equal(ui.explanation, "Click please");
    // Tag innards become plain text (not executable) — intentional.
    assert.equal(ui.confirmButtonText, "xOK");
  });
});

describe("ceremony lock", () => {
  it("abandonCeremony clears lock after cancel rejects the waiter", async () => {
    const { withCeremony, abandonCeremony } = await import("../src/state.js");

    /** @type {(error: Error) => void} */
    let rejectWait;
    const held = withCeremony(
      () =>
        new Promise((_, reject) => {
          rejectWait = reject;
        }),
    );

    await Promise.resolve();

    await abandonCeremony(() => {
      rejectWait(new Error("ceremonyCancelled"));
    });
    await assert.rejects(() => held, /ceremonyCancelled/);

    const result = await withCeremony(async () => "ok");
    assert.equal(result, "ok");
  });

  it("abandonCeremony unlocks even if the ceremony never settles", async () => {
    const { withCeremony, abandonCeremony } = await import("../src/state.js");

    void withCeremony(() => new Promise(() => {}));
    await Promise.resolve();

    await abandonCeremony(() => {});
    const result = await withCeremony(async () => "ok");
    assert.equal(result, "ok");
  });

  it("withCeremony steals a stuck lock instead of throwing ceremonyInProgress", async () => {
    const { withCeremony } = await import("../src/state.js");

    void withCeremony(() => new Promise(() => {}));
    await Promise.resolve();

    const result = await withCeremony(async () => "stolen");
    assert.equal(result, "stolen");
  });
});

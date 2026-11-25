import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { base58 } from "@scure/base";
import { ConversionUtils, HexString } from "@1shotapi/ows-types";
import {
  digestDataForSolanaBytes,
  solanaSignatureFromHex,
  solanaSignatureToBytes,
} from "../src/solana/marshal.ts";

describe("solana marshal", () => {
  it("round-trips ed25519 signature hex ↔ base58", () => {
    const bytes = new Uint8Array(64);
    for (let i = 0; i < 64; i++) bytes[i] = i;
    const hex = ConversionUtils.bytesToHex(bytes);
    const branded = solanaSignatureFromHex(hex as `0x${string}`);
    assert.equal(branded, base58.encode(bytes));
    assert.deepEqual(solanaSignatureToBytes(branded), bytes);
  });

  it("encodes message bytes as 0x hex for signDigest", () => {
    const msg = new TextEncoder().encode("hello");
    const digest = digestDataForSolanaBytes(msg);
    assert.equal(digest, HexString("0x68656c6c6f"));
  });
});

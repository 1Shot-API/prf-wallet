import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ConversionUtils,
  EVMAccountAddress,
  HexString,
} from "../src/index.js";

describe("ConversionUtils.addressToBytes32Hex", () => {
  it("left-pads a 20-byte address to 32 bytes", () => {
    const address = "0x4200000000000000000000000000000000000006" as const;
    const result = ConversionUtils.addressToBytes32Hex(address);
    assert.equal(
      result,
      HexString(
        "0x0000000000000000000000004200000000000000000000000000000000000006",
      ),
    );
    assert.equal((String(result).length - 2) / 2, 32);
  });

  it("accepts checksummed addresses and lowercases the output", () => {
    const checksummed = EVMAccountAddress(
      "0xAbCdEf0123456789AbCdEf0123456789aBcDeF01",
    );
    const result = ConversionUtils.addressToBytes32Hex(checksummed);
    assert.equal(
      result,
      HexString(
        "0x000000000000000000000000abcdef0123456789abcdef0123456789abcdef01",
      ),
    );
  });

  it("rejects non-20-byte hex", () => {
    assert.throws(
      () => ConversionUtils.addressToBytes32Hex("0x1234" as `0x${string}`),
      /20-byte/,
    );
  });

  it("rejects hex without 0x prefix at runtime via failed length match", () => {
    assert.throws(
      () =>
        ConversionUtils.addressToBytes32Hex(
          "4200000000000000000000000000000000000006" as `0x${string}`,
        ),
      /20-byte/,
    );
  });
});

describe("ConversionUtils hex roundtrip", () => {
  it("bytesToHex / hexToBytes", () => {
    const bytes = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const hex = ConversionUtils.bytesToHex(bytes);
    assert.equal(hex, HexString("0xdeadbeef"));
    assert.deepEqual(ConversionUtils.hexToBytes(hex), bytes);
  });
});

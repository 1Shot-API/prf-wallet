import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ConversionUtils,
  EVMAccountAddress,
  EVMContractAddress,
  HexString,
  SolanaAccountAddress,
  SolanaATAAddress,
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

  it("accepts EVMContractAddress", () => {
    const contract = EVMContractAddress(
      "0x4200000000000000000000000000000000000006",
    );
    const result = ConversionUtils.addressToBytes32Hex(contract);
    assert.equal(
      result,
      HexString(
        "0x0000000000000000000000004200000000000000000000000000000000000006",
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

describe("ConversionUtils.addressToSolanaPubkeyBytes", () => {
  it("left-pads an EVM address into 32 pubkey bytes", () => {
    const address = EVMAccountAddress(
      "0x4200000000000000000000000000000000000006",
    );
    const bytes = ConversionUtils.addressToSolanaPubkeyBytes(address);
    assert.equal(bytes.length, 32);
    assert.deepEqual(
      bytes,
      ConversionUtils.hexToBytes(
        HexString(
          "0x0000000000000000000000004200000000000000000000000000000000000006",
        ),
      ),
    );
  });
});

describe("ConversionUtils.solanaAccountToBytes32", () => {
  it("encodes a Solana account as bytes32 hex", () => {
    const account = SolanaAccountAddress(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    );
    const hex = ConversionUtils.solanaAccountToBytes32(account);
    assert.equal((String(hex).length - 2) / 2, 32);
    const ata = SolanaATAAddress(
      "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    );
    assert.equal(
      ConversionUtils.solanaAccountToBytes32(ata),
      hex,
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

describe("ConversionUtils base64 roundtrip", () => {
  it("bytesToBase64 / base64ToBytes", () => {
    const bytes = new TextEncoder().encode("Hello World");
    const encoded = ConversionUtils.bytesToBase64(bytes);
    assert.equal(encoded, "SGVsbG8gV29ybGQ=");
    assert.deepEqual(ConversionUtils.base64ToBytes(encoded), bytes);
  });
});

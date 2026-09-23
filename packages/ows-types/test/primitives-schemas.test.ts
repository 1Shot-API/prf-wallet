import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import {
  AES256CipherTextEnvelopeSchema,
  AES256CipherTextSchema,
  AnalyticsEventIdSchema,
  BitcoinChainIdSchema,
  BitcoinSegwitAccountAddressSchema,
  EChainTechnology,
  EChainTechnologySchema,
  ED25519PublicKeySchema,
  EVMAccountAddressSchema,
  EVMChainIdSchema,
  OWSChainIdSchema,
  SECP256K1PublicKeySchema,
  SolanaAccountAddressSchema,
} from "../src/index.ts";

describe("primitive Zod schemas", () => {
  it("checksums EVMAccountAddress via viem getAddress", () => {
    const raw = "0xabCDEF0123456789abcdef0123456789ABCDEF01";
    const parsed = EVMAccountAddressSchema.parse(raw);
    assert.equal(parsed, getAddress(raw));
  });

  it("normalizes EVMChainId leading zeros", () => {
    assert.equal(EVMChainIdSchema.parse("0x01"), "0x1");
    assert.equal(EVMChainIdSchema.parse("0x13b2"), "0x13b2");
  });

  it("accepts uncompressed SECP256K1PublicKey only", () => {
    const uncompressed = ("0x04" + "11".repeat(64)) as `0x${string}`;
    assert.equal(SECP256K1PublicKeySchema.parse(uncompressed), uncompressed.toLowerCase());
    assert.equal(
      SECP256K1PublicKeySchema.safeParse("0x02" + "11".repeat(32)).success,
      false,
    );
  });

  it("accepts 32-byte ED25519PublicKey", () => {
    const key = ("0x" + "ab".repeat(32)) as `0x${string}`;
    assert.equal(ED25519PublicKeySchema.parse(key), key.toLowerCase());
    assert.equal(
      ED25519PublicKeySchema.safeParse("0x" + "ab".repeat(31)).success,
      false,
    );
  });

  it("validates Bitcoin SegWit P2WPKH addresses", () => {
    const addr = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
    assert.equal(BitcoinSegwitAccountAddressSchema.parse(addr), addr);
    assert.equal(
      BitcoinSegwitAccountAddressSchema.safeParse("1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa")
        .success,
      false,
    );
  });

  it("validates Solana base58 addresses to 32 bytes", () => {
    // well-known system program id
    const addr = "11111111111111111111111111111111";
    assert.equal(SolanaAccountAddressSchema.parse(addr), addr);
    assert.equal(SolanaAccountAddressSchema.safeParse("not-base58!!!").success, false);
  });

  it("OWSChainIdSchema accepts EVM, Bitcoin, and Solana", () => {
    assert.equal(OWSChainIdSchema.parse("0x1"), "0x1");
    assert.equal(OWSChainIdSchema.parse("Bitcoin"), "Bitcoin");
    assert.equal(OWSChainIdSchema.parse("SolanaDevnet"), "SolanaDevnet");
    assert.equal(BitcoinChainIdSchema.parse("BitcoinTestnet"), "BitcoinTestnet");
  });

  it("AnalyticsEventIdSchema requires a UUID", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    assert.equal(AnalyticsEventIdSchema.parse(id), id);
    assert.equal(AnalyticsEventIdSchema.safeParse("not-a-uuid").success, false);
  });

  it("distinguishes AES ciphertext vs envelope", () => {
    assert.equal(
      AES256CipherTextSchema.parse("0xdeadbeef"),
      "0xdeadbeef",
    );
    assert.equal(
      AES256CipherTextEnvelopeSchema.parse("ows-aes1:0x01aabb"),
      "ows-aes1:0x01aabb",
    );
    assert.equal(
      AES256CipherTextEnvelopeSchema.safeParse("0xdeadbeef").success,
      false,
    );
  });

  it("EChainTechnologySchema accepts enum values", () => {
    assert.equal(EChainTechnologySchema.parse("evm"), EChainTechnology.Evm);
    assert.equal(EChainTechnologySchema.safeParse("cosmos").success, false);
  });
});

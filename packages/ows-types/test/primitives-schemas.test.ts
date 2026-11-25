import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";
import {
  AES256CipherTextEnvelopeSchema,
  AES256CipherTextSchema,
  AnalyticsEventIdSchema,
  Base64StringSchema,
  BitcoinAddressSchema,
  BitcoinLegacyAccountAddressSchema,
  BitcoinScriptHashAddressSchema,
  BitcoinSegwitScriptAddressSchema,
  BitcoinTaprootAccountAddressSchema,
  BitcoinChainIdSchema,
  BitcoinSegwitAccountAddressSchema,
  EChainTechnology,
  EChainTechnologySchema,
  ED25519PublicKeySchema,
  EVMAccountAddressSchema,
  EVMChainIdSchema,
  OWSChainIdSchema,
  SECP256K1CompressedPublicKeySchema,
  SECP256K1PublicKeySchema,
  SolanaAccountAddressSchema,
} from "../src/index.ts";

describe("primitive Zod schemas", () => {
  it("checksums EVMAccountAddress via viem getAddress", () => {
    const raw = "0xabCDEF0123456789abcdef0123456789ABCDEF01";
    const parsed = EVMAccountAddressSchema.parse(raw);
    assert.equal(parsed, getAddress(raw));
  });

  it("normalizes EVMChainId leading zeros and case", () => {
    assert.equal(EVMChainIdSchema.parse("0x01"), "0x1");
    assert.equal(EVMChainIdSchema.parse("0xAA"), "0xaa");
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

  it("accepts standard Base64String and rejects base64url alphabet", () => {
    assert.equal(Base64StringSchema.parse("SGVsbG8="), "SGVsbG8=");
    assert.equal(Base64StringSchema.safeParse("SGVsbG8_").success, false);
  });

  it("OWSChainIdSchema accepts EVM, Bitcoin, and Solana", () => {
    assert.equal(OWSChainIdSchema.parse("0x1"), "0x1");
    assert.equal(OWSChainIdSchema.parse("Bitcoin"), "Bitcoin");
    assert.equal(OWSChainIdSchema.parse("solana:devnet"), "solana:devnet");
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

describe("BitcoinAddressSchema", () => {
  const valid = [
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", // P2PKH mainnet
    "3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", // P2SH mainnet
    "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", // P2PKH testnet
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", // P2WPKH
    "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", // P2WPKH testnet
    "bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3", // P2WSH
    "bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0", // P2TR
  ];

  for (const address of valid) {
    it(`accepts ${address}`, () => {
      assert.equal(BitcoinAddressSchema.parse(address), address);
    });
  }

  it("lowercases uppercase bech32 and keeps base58 case", () => {
    assert.equal(
      BitcoinAddressSchema.parse("BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4"),
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    );
  });

  const invalid = [
    "",
    "hello",
    "1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNb", // bad base58 checksum
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t5", // bad bech32 checksum
    "bc1QW508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", // mixed case
    "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh", // v0 with bech32m checksum
    "0x4200000000000000000000000000000000000006", // EVM
  ];

  for (const address of invalid) {
    it(`rejects ${JSON.stringify(address)}`, () => {
      assert.equal(BitcoinAddressSchema.safeParse(address).success, false);
    });
  }
});

describe("SECP256K1CompressedPublicKeySchema", () => {
  it("accepts 0x02 / 0x03 prefixes and lowercases", () => {
    const key = `0x02${"AB".repeat(32)}`;
    assert.equal(
      SECP256K1CompressedPublicKeySchema.parse(key),
      key.toLowerCase(),
    );
    assert.equal(
      SECP256K1CompressedPublicKeySchema.safeParse(`0x03${"ab".repeat(32)}`)
        .success,
      true,
    );
  });

  it("rejects uncompressed and wrong-length keys", () => {
    assert.equal(
      SECP256K1CompressedPublicKeySchema.safeParse(`0x04${"ab".repeat(64)}`)
        .success,
      false,
    );
    assert.equal(
      SECP256K1CompressedPublicKeySchema.safeParse(`0x02${"ab".repeat(31)}`)
        .success,
      false,
    );
  });
});

describe("Bitcoin address type schemas", () => {
  const cases = [
    { schema: BitcoinLegacyAccountAddressSchema, addresses: ["1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa", "mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn"] },
    { schema: BitcoinScriptHashAddressSchema, addresses: ["3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy"] },
    { schema: BitcoinSegwitAccountAddressSchema, addresses: ["bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4", "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"] },
    { schema: BitcoinSegwitScriptAddressSchema, addresses: ["bc1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3qccfmv3"] },
    { schema: BitcoinTaprootAccountAddressSchema, addresses: ["bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0"] },
  ];

  it("each address validates under its own schema only", () => {
    for (const { schema, addresses } of cases) {
      for (const address of addresses) {
        for (const other of cases) {
          assert.equal(
            other.schema.safeParse(address).success,
            other.schema === schema,
            `${address} under ${other.addresses[0]}'s schema`,
          );
        }
      }
    }
  });
});

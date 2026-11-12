import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress } from "viem";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  EVMChainId,
} from "@1shotapi/ows-types";
import { AddressUtils } from "../src/AddressUtils.js";
import type { IBlockchainProvider } from "../src/IBlockchainProvider.js";

const CHAIN = EVMChainId("0x1");
const SAMPLE_HEX = "0xAbCdEf0123456789AbCdEf0123456789aBcDeF01";
const SAMPLE_CHECKSUM = getAddress(SAMPLE_HEX);

function mockProvider(): IBlockchainProvider {
  return {
    getPublicClient() {
      return {
        request: async () => null,
      } as never;
    },
  };
}

describe("AddressUtils", () => {
  it("returns EIP-55 checksummed EVM addresses", async () => {
    const utils = new AddressUtils(mockProvider());
    const a = await utils.validateEVMAddress(SAMPLE_HEX, CHAIN);
    const b = await utils.validateEVMAddress(
      "AbCdEf0123456789AbCdEf0123456789aBcDeF01",
      CHAIN,
    );
    const c = await utils.validateEVMAddress(SAMPLE_HEX.toLowerCase(), CHAIN);
    assert.equal(a, SAMPLE_CHECKSUM);
    assert.equal(b, SAMPLE_CHECKSUM);
    assert.equal(c, SAMPLE_CHECKSUM);
  });

  it("rejects invalid EVM addresses", async () => {
    const utils = new AddressUtils(mockProvider());
    await assert.rejects(() => utils.validateEVMAddress("0x1234", CHAIN));
    await assert.rejects(() => utils.validateEVMAddress("", CHAIN));
  });

  it("validates Solana base58", () => {
    const utils = new AddressUtils(mockProvider());
    const addr = utils.validateSolanaAddress(
      "7EqQdEULxWcraVx3mXKFjc84LhCkMGZCkRuDqvc3ei82",
    );
    assert.equal(typeof addr, "string");
    assert.throws(() => utils.validateSolanaAddress("0xnotsolana"));
  });

  it("validates Bitcoin Native SegWit (P2WPKH) addresses on mainnet and testnet", () => {
    const utils = new AddressUtils(mockProvider());

    // Valid mainnet P2WPKH
    const mainnet = utils.validateBitcoinSegwitAddress(
      "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
    );
    assert.equal(mainnet, "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");

    // Valid testnet P2WPKH
    const testnet = utils.validateBitcoinSegwitAddress(
      "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
      BITCOIN_TESTNET_CHAIN_ID,
    );
    assert.equal(testnet, "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx");

    // Rejects testnet on mainnet
    assert.throws(() =>
      utils.validateBitcoinSegwitAddress(
        "tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx",
        BITCOIN_MAINNET_CHAIN_ID,
      ),
    );

    // Rejects mainnet on testnet
    assert.throws(() =>
      utils.validateBitcoinSegwitAddress(
        "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        BITCOIN_TESTNET_CHAIN_ID,
      ),
    );

    // Rejects Taproot (bc1p...)
    assert.throws(() =>
      utils.validateBitcoinSegwitAddress(
        "bc1p5d7rjq7g6rdk2yhzks9s2cqmmxdumgah52q6g27ur76rw0vd2hsjqxpxaq",
      ),
    );

    // Rejects legacy Base58 address
    assert.throws(() =>
      utils.validateBitcoinSegwitAddress(
        "1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2",
      ),
    );

    // Rejects hex
    assert.throws(() =>
      utils.validateBitcoinSegwitAddress(
        "0xabcdef0123456789abcdef0123456789abcdef01",
      ),
    );
  });
});

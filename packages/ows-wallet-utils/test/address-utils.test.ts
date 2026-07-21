import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAddress } from "viem";
import { EVMChainId } from "@1shotapi/ows-types";
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

  it("normalizes Bitcoin hex with 0x", () => {
    const utils = new AddressUtils(mockProvider());
    const addr = utils.validateBitcoinAddress(
      "AbCdEf0123456789AbCdEf0123456789aBcDeF01",
    );
    assert.equal(addr, "0xabcdef0123456789abcdef0123456789abcdef01");
  });
});

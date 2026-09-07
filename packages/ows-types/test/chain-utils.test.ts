import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BITCOIN_CAIP2,
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  ChainUtils,
  EChainTechnology,
  EVMChainId,
  SOLANA_DEVNET_CHAIN_ID,
  SOLANA_MAINNET_CHAIN_ID,
} from "../src/index.js";

describe("ChainUtils", () => {
  it("narrows Bitcoin sentinels", () => {
    assert.equal(ChainUtils.isBitcoinChainId("Bitcoin"), true);
    assert.equal(ChainUtils.isBitcoinChainId("BitcoinTestnet"), true);
    assert.equal(ChainUtils.isBitcoinChainId(-1), false);
    assert.equal(ChainUtils.isBitcoinChainId("-1"), false);
    assert.equal(
      ChainUtils.asBitcoinChainId("BitcoinTestnet"),
      BITCOIN_TESTNET_CHAIN_ID,
    );
    assert.throws(() => ChainUtils.asBitcoinChainId("0x1"), /Invalid BitcoinChainId/);
  });

  it("narrows EVM hex chain ids", () => {
    assert.equal(ChainUtils.isEVMChainId("0x2105"), true);
    assert.equal(ChainUtils.isEVMChainId("Bitcoin"), false);
    assert.equal(ChainUtils.asEVMChainId("0x2105"), EVMChainId("0x2105"));
    assert.equal(ChainUtils.asEVMChainId("0xAa"), EVMChainId("0xaa"));
    assert.throws(() => ChainUtils.asEVMChainId("Bitcoin"), /Invalid EVMChainId/);
  });

  it("narrows Solana sentinels", () => {
    assert.equal(ChainUtils.isSolanaChainId("Solana"), true);
    assert.equal(ChainUtils.isSolanaChainId(SOLANA_DEVNET_CHAIN_ID), true);
    assert.equal(ChainUtils.isSolanaChainId("0x1"), false);
    assert.equal(
      ChainUtils.asSolanaChainId("Solana"),
      SOLANA_MAINNET_CHAIN_ID,
    );
    assert.throws(() => ChainUtils.asSolanaChainId("Bitcoin"), /Invalid SolanaChainId/);
  });

  it("maps technology and CAIP-2", () => {
    assert.equal(
      ChainUtils.technologyFor(BITCOIN_MAINNET_CHAIN_ID),
      EChainTechnology.Bitcoin,
    );
    assert.equal(
      ChainUtils.technologyFor(SOLANA_MAINNET_CHAIN_ID),
      EChainTechnology.Solana,
    );
    assert.equal(
      ChainUtils.technologyFor(EVMChainId("0x1")),
      EChainTechnology.Evm,
    );
    assert.equal(
      ChainUtils.bitcoinChainIdToCaip2(BITCOIN_MAINNET_CHAIN_ID),
      BITCOIN_CAIP2.MAINNET,
    );
    assert.equal(
      ChainUtils.caip2ToBitcoinChainId(BITCOIN_CAIP2.TESTNET),
      BITCOIN_TESTNET_CHAIN_ID,
    );
  });
});

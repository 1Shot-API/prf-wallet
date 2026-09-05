import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BITCOIN_MAINNET_CHAIN_ID,
  BITCOIN_TESTNET_CHAIN_ID,
  BitcoinSegwitAccountAddress,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1";
import {
  addressFromSecp256k1PublicKey,
  compressSecp256k1PublicKey,
} from "../src/bitcoin/address.js";
import {
  finalizeBitcoinTransaction,
  prepareBitcoinTransaction,
  type IBitcoinUnsignedTransaction,
} from "../src/bitcoin/marshal.js";

describe("bitcoin signer utils", () => {
  // Known secp256k1 key pair
  const privKey = new Uint8Array(32);
  privKey[31] = 1; // private key 1
  const uncompressedPub = secp256k1.getPublicKey(privKey, false);
  const uncompressedPubHex = ("0x" +
    Buffer.from(uncompressedPub).toString("hex")) as SECP256K1PublicKey;

  it("compresses 65-byte uncompressed public key correctly", () => {
    const compressed = compressSecp256k1PublicKey(uncompressedPubHex);
    assert.equal(compressed.length, 33);
    const expected = secp256k1.getPublicKey(privKey, true);
    assert.deepEqual(Array.from(compressed), Array.from(expected));
  });

  it("derives mainnet and testnet Native SegWit (P2WPKH) addresses", () => {
    const mainnetAddr = addressFromSecp256k1PublicKey(
      uncompressedPubHex,
      BITCOIN_MAINNET_CHAIN_ID,
    );
    const testnetAddr = addressFromSecp256k1PublicKey(
      uncompressedPubHex,
      BITCOIN_TESTNET_CHAIN_ID,
    );

    assert.ok(mainnetAddr.startsWith("bc1q"));
    assert.ok(testnetAddr.startsWith("tb1q"));
    assert.equal(
      mainnetAddr,
      BitcoinSegwitAccountAddress("bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4"),
    );
    assert.equal(
      testnetAddr,
      BitcoinSegwitAccountAddress("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx"),
    );
  });

  it("prepares BIP-143 sighashes and finalizes a valid P2WPKH transaction", () => {
    const mainnetAddr = addressFromSecp256k1PublicKey(
      uncompressedPubHex,
      BITCOIN_MAINNET_CHAIN_ID,
    );

    const unsignedTx: IBitcoinUnsignedTransaction = {
      chainId: BITCOIN_MAINNET_CHAIN_ID,
      inputs: [
        {
          txid: "0000000000000000000000000000000000000000000000000000000000000001",
          vout: 0,
          valueSats: 100000n,
        },
      ],
      outputs: [
        {
          address: mainnetAddr,
          valueSats: 90000n,
        },
      ],
    };

    const prepared = prepareBitcoinTransaction(unsignedTx, uncompressedPubHex);
    assert.equal(prepared.sighashes.length, 1);
    assert.equal(prepared.sighashes[0]!.length, 32);

    // Mock signing: compute low-S compact signature using secp256k1
    const sig = secp256k1.sign(prepared.sighashes[0]!, privKey, { lowS: true });
    const compactHex = ("0x" + Buffer.from(sig.toCompactRawBytes()).toString("hex")) as `0x${string}`;

    const finalized = finalizeBitcoinTransaction(prepared, [compactHex]);
    assert.ok(finalized.rawHex.length > 0);
    assert.equal(finalized.signatures.length, 1);
    assert.ok(/^[0-9a-f]{64}$/.test(finalized.txid));
  });
});

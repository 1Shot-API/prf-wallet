import {
  BITCOIN_MAINNET_CHAIN_ID,
  ConversionUtils,
  HexString,
  type BitcoinChainId,
  BitcoinSignatureHex,
  type BitcoinSegwitAccountAddress,
  BitcoinTransactionHash,
  type SECP256K1PublicKey,
} from "@1shotapi/ows-types";
import { secp256k1 } from "@noble/curves/secp256k1.js";
import * as btc from "@scure/btc-signer";
import {
  bitcoinNetworkForChainId,
  compressSecp256k1PublicKey,
} from "./address.js";

export interface IBitcoinTransactionInput {
  txid: BitcoinTransactionHash | string;
  vout: number;
  valueSats: bigint;
}

export interface IBitcoinTransactionOutput {
  address: BitcoinSegwitAccountAddress | string;
  valueSats: bigint;
}

export interface IBitcoinUnsignedTransaction {
  chainId?: BitcoinChainId;
  inputs: IBitcoinTransactionInput[];
  outputs: IBitcoinTransactionOutput[];
  lockTime?: number;
}

export interface IBitcoinSignedTransactionResult {
  rawHex: string;
  txid: BitcoinTransactionHash;
  signatures: BitcoinSignatureHex[];
}

export interface IPreparedBitcoinTransaction {
  tx: btc.Transaction;
  sighashes: Uint8Array[];
  compressedPubKey: Uint8Array;
}

/**
 * Build a SegWit P2WPKH transaction and compute its BIP-143 sighashes for signing.
 */
export function prepareBitcoinTransaction(
  unsignedTx: IBitcoinUnsignedTransaction,
  publicKey: SECP256K1PublicKey | Uint8Array,
): IPreparedBitcoinTransaction {
  if (unsignedTx.inputs.length === 0) {
    throw new Error("prepareBitcoinTransaction: transaction must have at least one input");
  }
  if (unsignedTx.outputs.length === 0) {
    throw new Error("prepareBitcoinTransaction: transaction must have at least one output");
  }

  const chainId = unsignedTx.chainId ?? BITCOIN_MAINNET_CHAIN_ID;
  const network = bitcoinNetworkForChainId(chainId);
  const compressedPubKey = compressSecp256k1PublicKey(publicKey);
  const p2w = btc.p2wpkh(compressedPubKey, network);

  const tx = new btc.Transaction({
    allowUnknownOutputs: false,
    disableScriptCheck: false,
    lockTime: unsignedTx.lockTime,
  });

  for (const input of unsignedTx.inputs) {
    const cleanTxid = input.txid.startsWith("0x")
      ? input.txid.slice(2).toLowerCase()
      : input.txid.toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(cleanTxid)) {
      throw new Error(`Invalid input txid: ${input.txid}`);
    }

    tx.addInput({
      txid: cleanTxid,
      index: input.vout,
      witnessUtxo: {
        script: p2w.script,
        amount: input.valueSats,
      },
    });
  }

  for (const output of unsignedTx.outputs) {
    tx.addOutputAddress(output.address, output.valueSats, network);
  }

  const script = btc.OutScript.encode({ type: "pkh", hash: p2w.hash });
  const sighashes: Uint8Array[] = [];

  for (let i = 0; i < unsignedTx.inputs.length; i++) {
    const input = unsignedTx.inputs[i]!;
    const sighash = tx.preimageWitnessV0(
      i,
      script,
      btc.SigHash.ALL,
      input.valueSats,
    );
    sighashes.push(sighash);
  }

  return { tx, sighashes, compressedPubKey };
}

/**
 * Apply compact ECDSA signatures (from `signDigest` scheme `secp256k1-ecdsa`),
 * attach witness scripts, and finalize the transaction.
 */
export function finalizeBitcoinTransaction(
  prepared: IPreparedBitcoinTransaction,
  compactSignaturesHex: Array<`0x${string}` | HexString>,
): IBitcoinSignedTransactionResult {
  const { tx, compressedPubKey } = prepared;

  if (compactSignaturesHex.length !== tx.inputsLength) {
    throw new Error(
      `Signature count (${compactSignaturesHex.length}) does not match input count (${tx.inputsLength})`,
    );
  }

  const signatures: BitcoinSignatureHex[] = [];

  for (let i = 0; i < compactSignaturesHex.length; i++) {
    const sigHex = compactSignaturesHex[i]!;
    const compactBytes = ConversionUtils.hexToBytes(HexString(sigHex));
    if (compactBytes.length !== 64) {
      throw new Error(
        `Invalid compact signature length for input ${i}: expected 64 bytes, got ${compactBytes.length}`,
      );
    }

    const parsedSig = secp256k1.Signature.fromBytes(compactBytes, "compact");
    const derBytes = parsedSig.toBytes("der");
    const sigWithHash = new Uint8Array(derBytes.length + 1);
    sigWithHash.set(derBytes);
    sigWithHash[derBytes.length] = btc.SigHash.ALL;

    tx.updateInput(i, {
      partialSig: [[compressedPubKey, sigWithHash]],
    });

    signatures.push(
      BitcoinSignatureHex(ConversionUtils.bytesToHex(sigWithHash)),
    );
  }

  tx.finalize();

  return {
    rawHex: tx.hex,
    txid: BitcoinTransactionHash(tx.id),
    signatures,
  };
}

import { address, type Address } from "@solana/addresses";
import type { SignatureBytes } from "@solana/keys";
import {
  getTransactionDecoder,
  getTransactionEncoder,
  type Transaction,
} from "@solana/transactions";

/**
 * Decode a Wallet Standard serialized transaction, return message bytes for
 * Branding `solana.signTransaction`, then merge the Ed25519 signature and
 * re-encode to wire bytes.
 */
export function extractMessageBytes(serializedTransaction: Uint8Array): {
  transaction: Transaction;
  messageBytes: Uint8Array;
} {
  const transaction = getTransactionDecoder().decode(serializedTransaction);
  return {
    transaction,
    messageBytes: new Uint8Array(transaction.messageBytes),
  };
}

export function attachSignatureAndEncode(
  transaction: Transaction,
  signerAddress: string,
  signatureBytes: Uint8Array,
): Uint8Array {
  const key = address(signerAddress) as Address;
  const next: Transaction = {
    messageBytes: transaction.messageBytes,
    signatures: {
      ...transaction.signatures,
      [key]: signatureBytes as SignatureBytes,
    },
  };
  return new Uint8Array(getTransactionEncoder().encode(next));
}

import { address, type Address } from "@solana/addresses";
import type {
  MessagePartialSigner,
  SignatureDictionary,
  TransactionPartialSigner,
} from "@solana/kit";
import type { SignatureBytes } from "@solana/keys";
import type { SolanaAccountAddress } from "@1shotapi/ows-types";
import type { OWSSigner } from "../owssigner.js";
import { solanaSignatureToBytes } from "./marshal.js";
import type { SolanaCallOptions } from "./namespace.js";

export type ToKitPartialSignerOptions = SolanaCallOptions & {
  /** Prefer this address over cache / `getAccountAddress` (no ceremony). */
  accountAddress?: SolanaAccountAddress;
};

export type OwsKitPartialSigner = MessagePartialSigner & TransactionPartialSigner;

/**
 * Build a Kit {@link MessagePartialSigner} + {@link TransactionPartialSigner}
 * backed by the Signing Layer (`signer.solana`).
 *
 * Branding can plug this into Kit transaction planners without Host RPC.
 */
export async function toKitPartialSigner(
  signer: OWSSigner,
  options?: ToKitPartialSignerOptions,
): Promise<OwsKitPartialSigner> {
  const accountAddress =
    options?.accountAddress ??
    signer.getCachedSolanaAddress() ??
    (await signer.solana.getAccountAddress({
      credentialId: options?.credentialId,
      explanationHeader: options?.explanationHeader,
      explanationText: options?.explanationText,
      confirmButtonText: options?.confirmButtonText,
      denyButtonText: options?.denyButtonText,
    }));

  const kitAddress = address(accountAddress) as Address;

  const ceremonyOptions: SolanaCallOptions | undefined = options
    ? {
        credentialId: options.credentialId,
        explanationHeader: options.explanationHeader,
        explanationText: options.explanationText,
        confirmButtonText: options.confirmButtonText,
        denyButtonText: options.denyButtonText,
      }
    : undefined;

  const partialSigner: OwsKitPartialSigner = {
    address: kitAddress,
    async signMessages(messages): Promise<readonly SignatureDictionary[]> {
      const signatures = await signer.solana.signMessage(
        messages.map((m) => m.content),
        ceremonyOptions,
      );
      return signatures.map((sig) => ({
        [kitAddress]: solanaSignatureToBytes(sig) as SignatureBytes,
      }));
    },
    async signTransactions(transactions): Promise<readonly SignatureDictionary[]> {
      const signed = await signer.solana.signTransaction(
        transactions.map((tx) => ({
          messageBytes: new Uint8Array(tx.messageBytes),
        })),
        ceremonyOptions,
      );
      return signed.map((result) => ({
        [kitAddress]: result.signatureBytes as SignatureBytes,
      }));
    },
  };

  return partialSigner;
}

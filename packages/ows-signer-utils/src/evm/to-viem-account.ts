import type { Hex, TypedDataDefinition } from "viem";
import type { LocalAccount } from "viem/accounts";
import type { EVMAccountAddress, SECP256K1PublicKey } from "@1shotapi/ows-types";
import type { OWSSigner } from "../owssigner.js";

export type ToViemLocalAccountOptions = {
  /** Prefer this address over `getCachedAddress` / `getAccountAddress` (no ceremony). */
  address?: EVMAccountAddress | Hex;
  /**
   * Prefer this secp256k1 public key over `getLastPublicKeyData` / `getPublicKey`.
   * When address is known and this is set (or cached), no Unlock ceremony runs.
   */
  publicKey?: SECP256K1PublicKey | Hex;
};

/**
 * Build a viem `LocalAccount` backed by the Signing Layer.
 *
 * When `address` (or a cached address) is available, this does **not** call
 * `getPublicKey` solely to fill `LocalAccount.publicKey` — pass `publicKey` from
 * branding storage after the first successful ceremony when possible.
 */
export async function toViemLocalAccount(
  signer: OWSSigner,
  options?: ToViemLocalAccountOptions,
): Promise<LocalAccount> {
  const cachedPk = signer.getLastPublicKeyData?.();
  const address =
    options?.address ??
    signer.getCachedAddress?.() ??
    (await signer.evm.getAccountAddress());

  let publicKey: Hex | undefined =
    (options?.publicKey as Hex | undefined) ??
    (cachedPk?.secp256k1PublicKey as Hex | undefined);

  if (!publicKey) {
    // Address was resolved without PRF; publicKey is unused by ECDSA sign paths
    // but required by viem's LocalAccount shape.
    publicKey = ("0x04" + "00".repeat(64)) as Hex;
  }

  if (options?.address && signer.setCachedAddress) {
    signer.setCachedAddress(address as EVMAccountAddress);
  }

  const account = {
    address: address as Hex,
    type: "local",
    source: "owsSigner",
    publicKey,
    async signMessage({ message }) {
      const [signature] = await signer.evm.signMessage([message]);
      return signature!;
    },
    async signTransaction(transaction) {
      const [signed] = await signer.evm.signTransaction([transaction]);
      return signed!;
    },
    async signTypedData(typedData) {
      const [signature] = await signer.evm.signTypedData([
        typedData as TypedDataDefinition,
      ]);
      return signature!;
    },
    async signAuthorization(authorization) {
      const [signed] = await signer.evm.signAuthorization([authorization]);
      return signed!;
    },
  } satisfies LocalAccount;

  return account;
}

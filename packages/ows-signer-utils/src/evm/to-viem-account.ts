import type { TypedDataDefinition } from "viem";
import type { LocalAccount } from "viem/accounts";
import type { OWSSigner } from "../owssigner.js";

export async function toViemLocalAccount(
  signer: OWSSigner,
): Promise<LocalAccount> {
  const address =
    signer.getCachedAddress?.() ?? (await signer.evm.getAccountAddress());
  const cached = signer.getLastPublicKeyData?.();
  const publicKeyResult =
    cached ??
    (await signer.getPublicKey({
      credentialId: signer.getCredentialId(),
    }));

  const account = {
    address: address,
    type: "local",
    source: "owsSigner",
    publicKey: publicKeyResult.secp256k1PublicKey,
    async signMessage({ message }) {
      return signer.evm.signMessage({ message });
    },
    async signTransaction(transaction) {
      return signer.evm.signTransaction(transaction);
    },
    async signTypedData(typedData) {
      return signer.evm.signTypedData(typedData as TypedDataDefinition);
    },
    async signAuthorization(authorization) {
      return signer.evm.signAuthorization(authorization);
    },
  } satisfies LocalAccount;

  return account;
}

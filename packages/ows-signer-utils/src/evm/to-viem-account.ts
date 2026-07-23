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

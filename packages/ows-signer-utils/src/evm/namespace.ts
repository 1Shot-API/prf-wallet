import { EVMAccountAddress } from "@1shotapi/ows-types";
import type {
  AuthorizationRequest,
  Hex,
  SignableMessage,
  SignedAuthorization,
  TransactionSerializable,
  TypedDataDefinition,
} from "viem";
import { parseSignature, serializeSignature } from "viem";
import { publicKeyToAddress } from "viem/utils";
import type { OWSSigner } from "../owssigner.js";
import {
  digestForAuthorization,
  digestForMessage,
  digestForTransaction,
  digestForTypedData,
  serializeSignedTransaction,
  signedAuthorizationFromSignature,
} from "./marshal.js";

const EVM_SIGN_SCHEME = "secp256k1-ecdsa-recoverable" as const;

/** Canonical 65-byte secp256k1 sig with v ∈ {27, 28} for on-chain ecrecover. */
function toEvmRecoverableSignature(signature: Hex): Hex {
  return serializeSignature(parseSignature(signature));
}

export type EvmCallOptions = {
  credentialId?: string;
};

export class EvmSigner {
  constructor(private readonly signer: OWSSigner) {}

  async getAccountAddress(
    options?: EvmCallOptions,
  ): Promise<EVMAccountAddress> {
    const cached = this.signer.getCachedAddress();
    if (cached) return cached;

    const publicKey = await this.signer.getPublicKey({
      credentialId: options?.credentialId ?? this.signer.getCredentialId(),
    });

    const address = EVMAccountAddress(
      publicKeyToAddress(publicKey.secp256k1PublicKey),
    );
    this.signer.setCachedAddress(address);
    return address;
  }

  async signMessage(
    args: { message: SignableMessage } & EvmCallOptions,
  ): Promise<Hex> {
    const { message, credentialId } = args;
    const digest = digestForMessage(message);
    const result = await this.signer.signDigest(
      digest,
      EVM_SIGN_SCHEME,
      credentialId ?? this.signer.getCredentialId(),
    );
    return toEvmRecoverableSignature(result.signature);
  }

  async signTypedData<const typedData extends TypedDataDefinition>(
    typedData: typedData,
    options?: EvmCallOptions,
  ): Promise<Hex> {
    const digest = digestForTypedData(typedData);
    const result = await this.signer.signDigest(
      digest,
      EVM_SIGN_SCHEME,
      options?.credentialId ?? this.signer.getCredentialId(),
    );
    return toEvmRecoverableSignature(result.signature);
  }

  async signTransaction(
    transaction: TransactionSerializable,
    options?: EvmCallOptions,
  ): Promise<Hex> {
    const digest = digestForTransaction(transaction);
    const result = await this.signer.signDigest(
      digest,
      EVM_SIGN_SCHEME,
      options?.credentialId ?? this.signer.getCredentialId(),
    );
    return serializeSignedTransaction(transaction, result.signature);
  }

  async signAuthorization(
    authorization: AuthorizationRequest,
    options?: EvmCallOptions,
  ): Promise<SignedAuthorization> {
    const digest = digestForAuthorization(authorization);
    const result = await this.signer.signDigest(
      digest,
      EVM_SIGN_SCHEME,
      options?.credentialId ?? this.signer.getCredentialId(),
    );
    return signedAuthorizationFromSignature(authorization, result.signature);
  }
}

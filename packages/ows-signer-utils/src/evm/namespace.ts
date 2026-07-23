import {
  EVMAccountAddress,
  EVMSignatureHex,
  HexString,
} from "@1shotapi/ows-types";
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
function toEvmRecoverableSignature(signature: Hex): EVMSignatureHex {
  return EVMSignatureHex(serializeSignature(parseSignature(signature)));
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
    messages: SignableMessage[],
    options?: EvmCallOptions,
  ): Promise<EVMSignatureHex[]> {
    if (messages.length === 0) return [];
    const credentialId =
      options?.credentialId ?? this.signer.getCredentialId();
    const results = await this.signer.signDigest(
      messages.map((message) => ({
        digestData: digestForMessage(message),
        scheme: EVM_SIGN_SCHEME,
      })),
      credentialId,
    );
    return results.map((r) => toEvmRecoverableSignature(r.signature));
  }

  async signTypedData(
    typedDataList: TypedDataDefinition[],
    options?: EvmCallOptions,
  ): Promise<EVMSignatureHex[]> {
    if (typedDataList.length === 0) return [];
    const credentialId =
      options?.credentialId ?? this.signer.getCredentialId();
    const results = await this.signer.signDigest(
      typedDataList.map((typedData) => ({
        digestData: digestForTypedData(typedData),
        scheme: EVM_SIGN_SCHEME,
      })),
      credentialId,
    );
    return results.map((r) => toEvmRecoverableSignature(r.signature));
  }

  async signTransaction(
    transactions: TransactionSerializable[],
    options?: EvmCallOptions,
  ): Promise<HexString[]> {
    if (transactions.length === 0) return [];
    const credentialId =
      options?.credentialId ?? this.signer.getCredentialId();
    const results = await this.signer.signDigest(
      transactions.map((transaction) => ({
        digestData: digestForTransaction(transaction),
        scheme: EVM_SIGN_SCHEME,
      })),
      credentialId,
    );
    return results.map((r, i) =>
      HexString(serializeSignedTransaction(transactions[i]!, r.signature)),
    );
  }

  async signAuthorization(
    authorizations: AuthorizationRequest[],
    options?: EvmCallOptions,
  ): Promise<SignedAuthorization[]> {
    if (authorizations.length === 0) return [];
    const credentialId =
      options?.credentialId ?? this.signer.getCredentialId();
    const results = await this.signer.signDigest(
      authorizations.map((authorization) => ({
        digestData: digestForAuthorization(authorization),
        scheme: EVM_SIGN_SCHEME,
      })),
      credentialId,
    );
    return results.map((r, i) =>
      signedAuthorizationFromSignature(authorizations[i]!, r.signature),
    );
  }
}

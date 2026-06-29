import {
  hashMessage,
  hashTypedData,
  keccak256,
  parseSignature,
  serializeTransaction,
} from "viem";
import { hashAuthorization } from "viem/utils";
import type {
  AuthorizationRequest,
  Hex,
  SignableMessage,
  SignedAuthorization,
  TransactionSerializable,
  TypedDataDefinition,
} from "viem";

export function digestForMessage(message: SignableMessage): Hex {
  return hashMessage(message);
}

export function digestForTypedData(
  typedData: TypedDataDefinition,
): Hex {
  return hashTypedData(typedData);
}

export function digestForTransaction(
  transaction: TransactionSerializable,
): Hex {
  const serialized = serializeTransaction(transaction);
  return keccak256(serialized);
}

export function digestForAuthorization(
  authorization: AuthorizationRequest,
): Hex {
  return hashAuthorization(authorization);
}

export function serializeSignedTransaction(
  transaction: TransactionSerializable,
  signature: Hex,
): Hex {
  return serializeTransaction(transaction, parseSignature(signature));
}

export function signedAuthorizationFromSignature(
  authorization: AuthorizationRequest,
  signature: Hex,
): SignedAuthorization {
  const parsed = parseSignature(signature);
  const address = authorization.address ?? authorization.contractAddress;
  if (!address) {
    throw new Error("Authorization requires address or contractAddress");
  }

  if ("v" in parsed && parsed.v !== undefined) {
    return {
      address,
      chainId: authorization.chainId,
      nonce: authorization.nonce,
      r: parsed.r,
      s: parsed.s,
      v: parsed.v,
    };
  }

  return {
    address,
    chainId: authorization.chainId,
    nonce: authorization.nonce,
    r: parsed.r,
    s: parsed.s,
    yParity: parsed.yParity,
  };
}

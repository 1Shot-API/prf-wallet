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

  // Relayers and EIP-7702 JSON payloads expect `yParity` (0|1). Prefer that even when
  // parseSignature also returns `v` (27|28) — omitting yParity becomes JSON null.
  const yParity =
    parsed.yParity ??
    (parsed.v !== undefined ? (Number(parsed.v) % 2 === 0 ? 1 : 0) : undefined);
  if (yParity !== 0 && yParity !== 1) {
    throw new Error("Authorization signature missing yParity");
  }

  return {
    address,
    chainId: authorization.chainId,
    nonce: authorization.nonce,
    r: parsed.r,
    s: parsed.s,
    yParity,
  };
}

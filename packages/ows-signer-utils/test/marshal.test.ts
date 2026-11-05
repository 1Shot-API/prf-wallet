import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashMessage,
  hashTypedData,
  keccak256,
  serializeTransaction,
} from "viem";
import {
  digestForAuthorization,
  digestForMessage,
  digestForTransaction,
  digestForTypedData,
  serializeSignedTransaction,
  signedAuthorizationFromSignature,
} from "../src/evm/marshal.ts";

describe("evm/marshal", () => {
  it("digestForMessage matches viem hashMessage", () => {
    const message = "hello ows";
    assert.equal(digestForMessage(message), hashMessage(message));
  });

  it("digestForTypedData matches viem hashTypedData", () => {
    const typedData = {
      domain: {
        name: "Test",
        version: "1",
        chainId: 1,
        verifyingContract: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      },
      types: {
        Mail: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "contents", type: "string" },
        ],
      },
      primaryType: "Mail" as const,
      message: {
        from: "0x0000000000000000000000000000000000000001",
        to: "0x0000000000000000000000000000000000000002",
        contents: "hi",
      },
    };
    assert.equal(digestForTypedData(typedData), hashTypedData(typedData));
  });

  it("digestForTransaction hashes serialized unsigned tx", () => {
    const transaction = {
      type: "legacy",
      chainId: 1,
      to: "0x0000000000000000000000000000000000000001",
      value: 0n,
      gas: 21_000n,
      gasPrice: 1_000_000_000n,
      nonce: 0,
    } as const;
    const serialized = serializeTransaction(transaction);
    assert.equal(digestForTransaction(transaction), keccak256(serialized));
  });

  it("serializeSignedTransaction produces signed hex", () => {
    const transaction = {
      type: "legacy",
      chainId: 1,
      to: "0x0000000000000000000000000000000000000001",
      value: 0n,
      gas: 21_000n,
      gasPrice: 1_000_000_000n,
      nonce: 0,
    } as const;
    const signature =
      `0x${"aa".repeat(32)}${"bb".repeat(32)}1c` as const;
    const signed = serializeSignedTransaction(transaction, signature);
    assert.match(signed, /^0x[0-9a-f]+$/i);
    assert.notEqual(signed, serializeTransaction(transaction));
  });

  it("signedAuthorizationFromSignature splits r/s/yParity", () => {
    const authorization = {
      chainId: 1,
      address: "0x0000000000000000000000000000000000000001",
      nonce: 0,
    } as const;
    const signature =
      `0x${"cc".repeat(32)}${"dd".repeat(32)}1b` as const;
    const digest = digestForAuthorization(authorization);
    assert.match(digest, /^0x[0-9a-f]{64}$/i);

    const signed = signedAuthorizationFromSignature(authorization, signature);
    assert.equal(signed.chainId, authorization.chainId);
    assert.equal(signed.address, authorization.address);
    assert.equal(signed.nonce, authorization.nonce);
    assert.match(signed.r, /^0x/);
    assert.match(signed.s, /^0x/);
    // Must expose yParity for relayer JSON (not only v), even when sig ends in 0x1b.
    assert.equal(signed.yParity, 0);
    assert.equal("v" in signed, false);
  });

  it("signedAuthorizationFromSignature maps v=28 to yParity=1", () => {
    const authorization = {
      chainId: 84532,
      address: "0x0000000000000000000000000000000000000001",
      nonce: 3,
    } as const;
    const signature =
      `0x${"11".repeat(32)}${"22".repeat(32)}1c` as const;
    const signed = signedAuthorizationFromSignature(authorization, signature);
    assert.equal(signed.yParity, 1);
  });
});

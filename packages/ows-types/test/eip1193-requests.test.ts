import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVMAccountAddress,
  EVMChainId,
  HexString,
  IEVMTransactionRequestSchema,
  type EIP1193RequestArgsFor,
  type EIP1193Requests,
  type EVMTransactionHash,
  type IEVMTransactionRequest,
} from "../src/index.js";

describe("EIP1193Requests eth_sendTransaction", () => {
  it("maps params to IEVMTransactionRequest and result to EVMTransactionHash", () => {
    type SendArgs = EIP1193RequestArgsFor<"eth_sendTransaction">;
    type SendResult = EIP1193Requests["eth_sendTransaction"]["result"];

    const args: SendArgs = {
      method: "eth_sendTransaction",
      params: [
        {
          to: EVMAccountAddress(
            "0x1111111111111111111111111111111111111111",
          ),
          data: HexString("0x"),
          value: HexString("0x0"),
        } satisfies IEVMTransactionRequest,
      ],
    };
    assert.equal(args.method, "eth_sendTransaction");

    const hash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as EVMTransactionHash;
    const result: SendResult = hash;
    assert.equal(result.startsWith("0x"), true);
  });
});

describe("IEVMTransactionRequestSchema", () => {
  it("brands addresses, hex quantities, and chainId", () => {
    const tx = IEVMTransactionRequestSchema.parse({
      from: "0x1111111111111111111111111111111111111111",
      to: null,
      value: "0x0",
      data: "0x",
      gas: "0x5208",
      chainId: "0x01",
      type: "0x2",
      accessList: [],
    });
    assert.equal(
      tx.from,
      EVMAccountAddress("0x1111111111111111111111111111111111111111"),
    );
    assert.equal(tx.to, null);
    assert.equal(tx.value, HexString("0x0"));
    assert.equal(tx.chainId, EVMChainId("0x1"));
    assert.equal(tx.type, "0x2");
    assert.deepEqual(tx.accessList, []);
  });

  it("accepts an empty object", () => {
    assert.deepEqual(IEVMTransactionRequestSchema.parse({}), {});
  });

  it("rejects non-objects and invalid fields", () => {
    assert.equal(IEVMTransactionRequestSchema.safeParse(null).success, false);
    assert.equal(IEVMTransactionRequestSchema.safeParse([]).success, false);
    assert.equal(
      IEVMTransactionRequestSchema.safeParse({ value: 1 }).success,
      false,
    );
    assert.equal(
      IEVMTransactionRequestSchema.safeParse({
        from: "not-an-address",
      }).success,
      false,
    );
  });
});

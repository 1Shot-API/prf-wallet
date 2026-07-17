import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EIP1193RequestArgsFor,
  EIP1193Requests,
  EVMTransactionHash,
  IEVMTransactionRequest,
} from "../src/index.ts";

describe("EIP1193Requests eth_sendTransaction", () => {
  it("maps params to IEVMTransactionRequest and result to EVMTransactionHash", () => {
    type SendArgs = EIP1193RequestArgsFor<"eth_sendTransaction">;
    type SendResult = EIP1193Requests["eth_sendTransaction"]["result"];

    const args: SendArgs = {
      method: "eth_sendTransaction",
      params: [
        {
          to: "0x1111111111111111111111111111111111111111" as never,
          data: "0x" as never,
          value: "0x0" as never,
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

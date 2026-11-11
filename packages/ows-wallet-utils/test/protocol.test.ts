import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  deserializeRpcRequest,
  deserializeRpcResponse,
  OwsInvalidParamsError,
  RPCCallId,
  serializeRpc,
} from "@1shotapi/ows-types";
import { getEip1193ParamSchema } from "../src/eip1193/schemas.js";
import { runHandler } from "../src/rpc/handler.js";

describe("protocol/serde", () => {
  it("roundtrips request and response envelopes", () => {
    const request = { callId: RPCCallId(1), method: "eth_chainId", params: [] };
    assert.deepEqual(deserializeRpcRequest(serializeRpc(request)), request);

    const response = { callId: RPCCallId(1), success: true, result: "0x1" };
    assert.deepEqual(deserializeRpcResponse(serializeRpc(response)), response);
  });
});

describe("eip1193/schemas", () => {
  it("validates personal_sign params", () => {
    const schema = getEip1193ParamSchema("personal_sign");
    const result = schema.safeParse([
      "0x6869",
      "0x0000000000000000000000000000000000000001",
    ]);
    assert.equal(result.success, true);
  });

  it("rejects invalid personal_sign params", () => {
    const schema = getEip1193ParamSchema("personal_sign");
    const result = schema.safeParse(["hello"]);
    assert.equal(result.success, false);
  });

  it("rejects a wallet_sendCalls chain id with leading zeros", () => {
    const schema = getEip1193ParamSchema("wallet_sendCalls");
    const result = schema.safeParse([
      {
        version: "2.0.0",
        chainId: "0x01",
        atomicRequired: true,
        calls: [
          { to: "0x0000000000000000000000000000000000000001" },
        ],
      },
    ]);
    assert.equal(result.success, false);
  });

  it("rejects a wallet_sendCalls version other than 2.0.0", () => {
    const schema = getEip1193ParamSchema("wallet_sendCalls");
    const result = schema.safeParse([
      {
        version: "1.0",
        chainId: "0x1",
        atomicRequired: false,
        calls: [
          { to: "0x0000000000000000000000000000000000000001" },
        ],
      },
    ]);
    assert.equal(result.success, false);
  });

  it("accepts wallet_sendCalls with an optional capability", () => {
    const schema = getEip1193ParamSchema("wallet_sendCalls");
    const result = schema.safeParse([
      {
        version: "2.0.0",
        chainId: "0x1",
        atomicRequired: true,
        calls: [
          {
            to: "0x0000000000000000000000000000000000000001",
            data: "0x",
            value: "0x0",
          },
        ],
        capabilities: {
          paymasterService: { url: "https://pay.example", optional: true },
        },
      },
    ]);
    assert.equal(result.success, true);
    if (result.success) {
      const params = result.data as [{ chainId: string }];
      assert.equal(params[0].chainId, "0x1");
    }
  });

  it("rejects wallet_getCapabilities chain ids with leading zeros", () => {
    const schema = getEip1193ParamSchema("wallet_getCapabilities");
    const result = schema.safeParse([
      "0x0000000000000000000000000000000000000001",
      ["0x01"],
    ]);
    assert.equal(result.success, false);
  });
});

describe("rpc/handler", () => {
  it("throws OwsInvalidParamsError when schema fails", async () => {
    await assert.rejects(
      runHandler("bad", z.tuple([z.string()]), async () => "ok"),
      OwsInvalidParamsError,
    );
  });
});

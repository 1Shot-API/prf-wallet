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
});

describe("rpc/handler", () => {
  it("throws OwsInvalidParamsError when schema fails", async () => {
    await assert.rejects(
      runHandler("bad", z.tuple([z.string()]), async () => "ok"),
      OwsInvalidParamsError,
    );
  });
});

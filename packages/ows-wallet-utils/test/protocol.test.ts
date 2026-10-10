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

  it("preserves wallet_requestExecutionPermissions rules", () => {
    const schema = getEip1193ParamSchema("wallet_requestExecutionPermissions");
    const target = "0x3e6a2f0CBA03d293B54c9fCF354948903007a798";
    const result = schema.safeParse([
      {
        chainId: "0x2105",
        to: "0x1111111111111111111111111111111111111111",
        permission: {
          type: "erc20-token-periodic",
          isAdjustmentAllowed: true,
          data: { tokenAddress: "0x2222222222222222222222222222222222222222" },
        },
        rules: [
          {
            type: "allowedTargets",
            data: { targets: [target] },
          },
        ],
      },
    ]);
    assert.equal(result.success, true);
    if (!result.success) return;
    const [entry] = result.data as Array<{
      rules?: Array<{ type: string; data: Record<string, unknown> }>;
      caveats?: unknown;
    }>;
    assert.equal(entry?.rules?.length, 1);
    assert.equal(entry?.rules?.[0]?.type, "allowedTargets");
    assert.deepEqual(entry?.rules?.[0]?.data, { targets: [target] });
    assert.equal("caveats" in (entry ?? {}), false);
  });

  it("normalizes legacy caveats into rules", () => {
    const schema = getEip1193ParamSchema("wallet_requestExecutionPermissions");
    const target = "0x3e6a2f0CBA03d293B54c9fCF354948903007a798";
    const result = schema.safeParse([
      {
        chainId: "0x2105",
        to: "0x1111111111111111111111111111111111111111",
        permission: {
          type: "erc20-token-periodic",
          isAdjustmentAllowed: true,
          data: {},
        },
        caveats: [
          {
            type: "allowedTargets",
            data: { targets: [target] },
          },
        ],
      },
    ]);
    assert.equal(result.success, true);
    if (!result.success) return;
    const [entry] = result.data as Array<{
      rules?: Array<{ type: string; data: Record<string, unknown> }>;
      caveats?: unknown;
    }>;
    assert.equal(entry?.rules?.length, 1);
    assert.equal(entry?.rules?.[0]?.type, "allowedTargets");
    assert.equal("caveats" in (entry ?? {}), false);
  });

  it("prefers rules when both rules and caveats are present", () => {
    const schema = getEip1193ParamSchema("wallet_requestExecutionPermissions");
    const result = schema.safeParse([
      {
        chainId: "0x2105",
        to: "0x1111111111111111111111111111111111111111",
        permission: {
          type: "erc20-token-periodic",
          isAdjustmentAllowed: true,
          data: {},
        },
        rules: [{ type: "limitedCalls", data: { limit: 1 } }],
        caveats: [{ type: "allowedTargets", data: { targets: [] } }],
      },
    ]);
    assert.equal(result.success, true);
    if (!result.success) return;
    const [entry] = result.data as Array<{
      rules?: Array<{ type: string }>;
    }>;
    assert.equal(entry?.rules?.[0]?.type, "limitedCalls");
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

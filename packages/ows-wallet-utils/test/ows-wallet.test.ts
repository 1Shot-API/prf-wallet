import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  OWS_RPC_CALLBACK_EVENT,
  OwsUnimplementedError,
  deserializeRpcResponse,
  serializeRpc,
  RPCCallId,
} from "@1shotapi/ows-types";
import { handleRpcModelCall } from "../src/rpc/child-wrapper.ts";

describe("handleRpcModelCall", () => {
  const emitted: Array<{ name: string; data: string }> = [];
  const childApi = {
    emit(name: string, data: string) {
      emitted.push({ name, data });
    },
  };

  afterEach(() => {
    emitted.length = 0;
  });

  it("returns success via ows:rpcCallback", async () => {
    await handleRpcModelCall(
      childApi,
      serializeRpc({ callId: RPCCallId(1), method: "custom", params: { foo: 1 } }),
      {
      handler: async (params) => ({ echo: params }),
    });

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.name, OWS_RPC_CALLBACK_EVENT);
    const response = deserializeRpcResponse(emitted[0]!.data);
    assert.equal(response.success, true);
    assert.deepEqual(response.result, { echo: { foo: 1 } });
  });

  it("returns unimplemented error envelope", async () => {
    await handleRpcModelCall(
      childApi,
      serializeRpc({ callId: RPCCallId(2), method: "missing", params: null }),
      {
      handler: async () => {
        throw new OwsUnimplementedError("nope");
      },
    });

    const response = deserializeRpcResponse(emitted[0]!.data);
    assert.equal(response.success, false);
    assert.equal(response.error?.code, -32_601);
  });

  it("validates params with zod schema", async () => {
    await handleRpcModelCall(
      childApi,
      serializeRpc({ callId: RPCCallId(3), method: "custom", params: { bad: true } }),
      {
        paramsSchema: z.object({ foo: z.number() }),
        handler: async () => "ok",
      },
    );

    const response = deserializeRpcResponse(emitted[0]!.data);
    assert.equal(response.success, false);
    assert.equal(response.error?.code, -32_602);
  });

  it("dispatches Bitcoin getAccountAddresses through BitcoinWalletRegistrar", async () => {
    const { BitcoinWalletRegistrar } = await import(
      "../src/bitcoin/wallet-registrar.ts"
    );
    const registrar = new BitcoinWalletRegistrar();
    let calledWith: unknown = null;
    registrar.register({
      getAccountAddresses: async (params) => {
        calledWith = params;
        return [
          {
            address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4" as never,
            intention: "payment",
          },
        ];
      },
    });

    const reg = registrar.getRegistration("bitcoin.getAccountAddresses");
    assert.ok(reg);

    await handleRpcModelCall(
      childApi,
      serializeRpc({
        callId: RPCCallId(4),
        method: "bitcoin.getAccountAddresses",
        params: { chainId: "Bitcoin" },
      }),
      reg,
      "bitcoin.getAccountAddresses",
    );

    assert.deepEqual(calledWith, { chainId: "Bitcoin" });
    const response = deserializeRpcResponse(emitted[0]!.data);
    assert.equal(response.success, true);
    assert.deepEqual(response.result, [
      {
        address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
        intention: "payment",
      },
    ]);
  });
});

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { OWS_RPC_CALLBACK_EVENT, RPCCallId } from "@1shotapi/ows-types";
import { RpcHostClient } from "../src/rpc/host-client.ts";
import { createEip1193Provider } from "../src/eip1193/provider.ts";

describe("RpcHostClient", () => {
  afterEach(() => {
    // @ts-expect-error cleanup
    delete globalThis.window;
  });

  it("resolves RPC callbacks from child emit", async () => {
    const listeners = new Map<string, (data: unknown) => void>();
    const child = {
      on(event: string, cb: (data: unknown) => void) {
        listeners.set(event, cb);
      },
      call(method: string, data: string) {
        const request = JSON.parse(data) as { callId: RPCCallId; params: unknown };
        const response = {
          callId: request.callId,
          success: true,
          result: { method, params: request.params },
        };
        listeners.get(OWS_RPC_CALLBACK_EVENT)?.(JSON.stringify(response));
      },
    };

    const client = new RpcHostClient(child as never, 5_000);
    const result = await client.request("customMethod", { foo: 1 });
    assert.deepEqual(result, { method: "customMethod", params: { foo: 1 } });
    client.destroy();
  });

  it("rejects unimplemented errors from callback", async () => {
    const listeners = new Map<string, (data: unknown) => void>();
    const child = {
      on(event: string, cb: (data: unknown) => void) {
        listeners.set(event, cb);
      },
      call(_method: string, data: string) {
        const request = JSON.parse(data) as { callId: RPCCallId };
        listeners.get(OWS_RPC_CALLBACK_EVENT)?.(
          JSON.stringify({
            callId: request.callId,
            success: false,
            error: { code: -32_601, message: "not implemented" },
          }),
        );
      },
    };

    const client = new RpcHostClient(child as never, 5_000);
    await assert.rejects(
      client.request("missing", null),
      (error: Error) => error.name === "OwsUnimplementedError",
    );
    client.destroy();
  });
});

describe("createEip1193Provider", () => {
  it("normalizes missing params to an empty array", async () => {
    const provider = createEip1193Provider(async (method, params) => {
      return { method, params };
    });

    const result = await provider.request({ method: "eth_chainId" });
    assert.deepEqual(result, { method: "eth_chainId", params: [] });
  });

  it("forwards explicit params arrays", async () => {
    const provider = createEip1193Provider(async (_method, params) => params);

    const result = await provider.request({
      method: "personal_sign",
      params: ["0xhi", "0x0000000000000000000000000000000000000001"],
    });

    assert.deepEqual(result, [
      "0xhi",
      "0x0000000000000000000000000000000000000001",
    ]);
  });
});

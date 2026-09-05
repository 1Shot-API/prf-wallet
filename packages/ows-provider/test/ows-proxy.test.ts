import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EVMAccountAddress, OWS_RPC_CALLBACK_EVENT, RPCCallId } from "@1shotapi/ows-types";
import { RpcHostClient } from "../src/rpc/RpcHostClient.ts";
import { EIP1193Provider } from "../src/eip1193/EIP1193Provider.ts";

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

describe("EIP1193Provider", () => {
  it("normalizes missing params to an empty array", async () => {
    const provider = new EIP1193Provider(async (method, params) => {
      return { method, params };
    });

    const result = await provider.request({ method: "eth_chainId" });
    assert.deepEqual(result, { method: "eth_chainId", params: [] });
  });

  it("forwards explicit params arrays", async () => {
    const provider = new EIP1193Provider(async (_method, params) => params);

    const result = await provider.request({
      method: "personal_sign",
      params: [
        "0xhi",
        EVMAccountAddress("0x0000000000000000000000000000000000000001"),
      ],
    });

    assert.deepEqual(result, [
      "0xhi",
      "0x0000000000000000000000000000000000000001",
    ]);
  });

  it("infers EVMAccountAddress[] for eth_requestAccounts", async () => {
    const address = EVMAccountAddress(
      "0x00000000000000000000000000000000000000ab",
    );
    const provider = new EIP1193Provider(async () => [address]);

    const accounts = await provider.request({ method: "eth_requestAccounts" });
    assert.equal(accounts[0], address);
  });

  it("emits provider events to on() listeners", () => {
    const provider = new EIP1193Provider(async () => null);
    const seen: unknown[] = [];
    provider.on("chainChanged", (chainId) => {
      seen.push(chainId);
    });
    provider.emit("chainChanged", "0x2105");
    assert.deepEqual(seen, ["0x2105"]);
  });
});

describe("BitcoinHostClient", () => {
  it("forwards getAccountAddresses through RpcHostClient with namespaced wire method", async () => {
    const { BitcoinHostClient } = await import("../src/bitcoin/host-client.ts");
    const sentCalls: Array<{ method: string; params: unknown }> = [];
    const mockRpcClient = {
      request: async <T>(method: string, params: unknown): Promise<T> => {
        sentCalls.push({ method, params });
        return [
          {
            address: "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4",
            intention: "payment",
          },
        ] as T;
      },
    };

    const client = new BitcoinHostClient(mockRpcClient as never);
    const result = await client.getAccountAddresses();

    assert.equal(sentCalls.length, 1);
    assert.equal(sentCalls[0]?.method, "bitcoin.getAccountAddresses");
    assert.deepEqual(sentCalls[0]?.params, {});
    assert.equal(result.length, 1);
    assert.equal(result[0]?.address, "bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4");
  });
});

import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  EIP1193_READ_METHODS,
  EIP1193_UNRECOGNIZED_CHAIN_ID,
  EVMChainId,
  OwsInvalidParamsError,
  OwsRpcError,
} from "@1shotapi/ows-types";
import {
  normalizeChainId,
  RpcHelper,
  type Eip1193Handler,
  type RpcHelperWallet,
} from "../src/index.ts";

function createMockWallet(): {
  wallet: RpcHelperWallet;
  handlers: Map<string, Eip1193Handler>;
} {
  const handlers = new Map<string, Eip1193Handler>();
  return {
    handlers,
    wallet: {
      registerEip1193(method, handler) {
        handlers.set(method, handler);
      },
    },
  };
}

const SEPOLIA = EVMChainId("0xaa36a7");
const BASE_SEPOLIA = EVMChainId("0x14a34");

describe("normalizeChainId", () => {
  it("canonicalizes leading zeros", () => {
    assert.equal(normalizeChainId("0x0aa36a7"), SEPOLIA);
  });

  it("rejects non-hex", () => {
    assert.throws(
      () => normalizeChainId("11155111"),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });
});

describe("RpcHelper", () => {
  it("registers eth_chainId, switch, and read methods", () => {
    const { wallet, handlers } = createMockWallet();
    new RpcHelper(
      new Map([[SEPOLIA, "https://example.invalid"]]),
      wallet,
      null,
    );

    assert.equal(typeof handlers.get("eth_chainId"), "function");
    assert.equal(
      typeof handlers.get("wallet_switchEthereumChain"),
      "function",
    );
    for (const method of EIP1193_READ_METHODS) {
      assert.equal(typeof handlers.get(method), "function", method);
    }
  });

  it("defaults to first provider chain", async () => {
    const { wallet, handlers } = createMockWallet();
    const helper = new RpcHelper(
      new Map([
        [SEPOLIA, "https://sepolia.example"],
        [BASE_SEPOLIA, "https://base.example"],
      ]),
      wallet,
    );

    assert.equal(helper.getChainId(), SEPOLIA);
    assert.equal(await handlers.get("eth_chainId")!([]), SEPOLIA);
  });

  it("honors defaultChainId", () => {
    const { wallet } = createMockWallet();
    const helper = new RpcHelper(
      new Map([
        [SEPOLIA, "https://sepolia.example"],
        [BASE_SEPOLIA, "https://base.example"],
      ]),
      wallet,
      undefined,
      { defaultChainId: BASE_SEPOLIA },
    );
    assert.equal(helper.getChainId(), BASE_SEPOLIA);
  });

  it("switchChain updates id and emits chainChanged", async () => {
    const { wallet, handlers } = createMockWallet();
    const helper = new RpcHelper(
      new Map([
        [SEPOLIA, "https://sepolia.example"],
        [BASE_SEPOLIA, "https://base.example"],
      ]),
      wallet,
    );

    const seen: EVMChainId[] = [];
    helper.events.on("chainChanged", (id) => {
      seen.push(id);
    });

    await helper.switchChain(BASE_SEPOLIA);
    assert.equal(helper.getChainId(), BASE_SEPOLIA);
    assert.deepEqual(seen, [BASE_SEPOLIA]);

    await handlers.get("wallet_switchEthereumChain")!([
      { chainId: SEPOLIA },
    ]);
    assert.equal(helper.getChainId(), SEPOLIA);
  });

  it("rejects unknown chains with EIP-1193 code 4902", async () => {
    const { wallet } = createMockWallet();
    const helper = new RpcHelper(
      new Map([[SEPOLIA, "https://sepolia.example"]]),
      wallet,
    );

    await assert.rejects(
      () => helper.switchChain(BASE_SEPOLIA),
      (error: unknown) =>
        error instanceof OwsRpcError &&
        error.code === EIP1193_UNRECOGNIZED_CHAIN_ID,
    );
  });

  it("beforeSwitchChain can veto a switch", async () => {
    const { wallet, handlers } = createMockWallet();
    const helper = new RpcHelper(
      new Map([
        [SEPOLIA, "https://sepolia.example"],
        [BASE_SEPOLIA, "https://base.example"],
      ]),
      wallet,
      null,
      {
        beforeSwitchChain: async (chainId) => chainId !== BASE_SEPOLIA,
      },
    );

    await handlers.get("wallet_switchEthereumChain")!([
      { chainId: BASE_SEPOLIA },
    ]);
    assert.equal(helper.getChainId(), SEPOLIA);
  });

  it("proxies read methods via fetch", async () => {
    const { wallet, handlers } = createMockWallet();
    new RpcHelper(
      new Map([[SEPOLIA, "https://rpc.example"]]),
      wallet,
    );

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0x1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );

    try {
      const result = await handlers.get("eth_blockNumber")!([]);
      assert.equal(result, "0x1");
      assert.equal(fetchMock.mock.callCount(), 1);
      const [url, init] = fetchMock.mock.calls[0]!.arguments as [
        string,
        RequestInit,
      ];
      assert.equal(url, "https://rpc.example");
      const body = JSON.parse(String(init.body)) as {
        method: string;
        params: unknown[];
      };
      assert.equal(body.method, "eth_blockNumber");
      assert.deepEqual(body.params, []);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("maps JSON-RPC errors to OwsRpcError", async () => {
    const { wallet, handlers } = createMockWallet();
    new RpcHelper(
      new Map([[SEPOLIA, "https://rpc.example"]]),
      wallet,
    );

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32_000, message: "server error" },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    try {
      await assert.rejects(
        () => handlers.get("eth_call")!([{ to: "0x1" }, "latest"]),
        (error: unknown) =>
          error instanceof OwsRpcError &&
          error.code === -32_000 &&
          error.message === "server error",
      );
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("request() uses the active chain provider", async () => {
    const { wallet } = createMockWallet();
    const helper = new RpcHelper(
      new Map([
        [SEPOLIA, "https://sepolia.example"],
        [BASE_SEPOLIA, "https://base.example"],
      ]),
      wallet,
    );

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xabc" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    try {
      const result = await helper.request("eth_getBalance", [
        "0x1111111111111111111111111111111111111111",
        "latest",
      ]);
      assert.equal(result, "0xabc");
      const [url, init] = fetchMock.mock.calls[0]!.arguments as [
        string,
        RequestInit,
      ];
      assert.equal(url, "https://sepolia.example");
      const body = JSON.parse(String(init.body)) as {
        method: string;
        params: unknown[];
      };
      assert.equal(body.method, "eth_getBalance");
      assert.equal(body.params.length, 2);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("sendRawTransaction returns a branded hash", async () => {
    const { wallet } = createMockWallet();
    const helper = new RpcHelper(
      new Map([[SEPOLIA, "https://rpc.example"]]),
      wallet,
    );
    const hash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, result: hash }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    try {
      const result = await helper.sendRawTransaction(
        "0xsignedraw" as `0x${string}`,
      );
      assert.equal(result, hash);
      const [, init] = fetchMock.mock.calls[0]!.arguments as [
        string,
        RequestInit,
      ];
      const body = JSON.parse(String(init.body)) as {
        method: string;
        params: unknown[];
      };
      assert.equal(body.method, "eth_sendRawTransaction");
      assert.deepEqual(body.params, ["0xsignedraw"]);
    } finally {
      fetchMock.mock.restore();
    }
  });

  it("sendRawTransaction rejects invalid hash results", async () => {
    const { wallet } = createMockWallet();
    const helper = new RpcHelper(
      new Map([[SEPOLIA, "https://rpc.example"]]),
      wallet,
    );

    const fetchMock = mock.method(
      globalThis,
      "fetch",
      async () =>
        new Response(
          JSON.stringify({ jsonrpc: "2.0", id: 1, result: "0xbad" }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );

    try {
      await assert.rejects(
        () => helper.sendRawTransaction("0xsignedraw" as `0x${string}`),
        (error: unknown) => error instanceof OwsRpcError,
      );
    } finally {
      fetchMock.mock.restore();
    }
  });
});

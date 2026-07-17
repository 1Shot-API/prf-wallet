import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVMAccountAddress,
  EVMChainId,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  OwsUserRejectedError,
} from "@1shotapi/ows-types";
import {
  SignHelper,
  parseTypedData,
  type SignHelperChainRpc,
  type SignHelperSigner,
  type SignHelperWallet,
} from "../src/eip1193/sign-helper.ts";

function createMocks(options?: {
  cachedAddress?: EVMAccountAddress | null;
  chainId?: EVMChainId;
}) {
  const calls: string[] = [];
  let hideCount = 0;
  const chainId = options?.chainId ?? EVMChainId("0xaa36a7");
  let cached = options?.cachedAddress ?? null;

  const wallet: SignHelperWallet = {
    async requestDisplay() {
      calls.push("requestDisplay");
      return {
        async hide() {
          hideCount += 1;
          calls.push("hide");
        },
      };
    },
  };

  const signer: SignHelperSigner = {
    getCachedAddress: () => cached,
    evm: {
      async getAccountAddress() {
        calls.push("getAccountAddress");
        const address = EVMAccountAddress(
          "0x1111111111111111111111111111111111111111",
        );
        cached = address;
        return address;
      },
      async signMessage({ message }) {
        calls.push(`signMessage:${message}`);
        return "0xsig";
      },
      async signTypedData(typedData) {
        calls.push(`signTypedData:${typedData.primaryType}`);
        return "0xtyped";
      },
      async signTransaction(transaction) {
        calls.push(`signTransaction:${transaction.chainId}`);
        return "0xsignedraw";
      },
    },
  };

  const rpcCalls: Array<{ method: string; params: unknown[] }> = [];
  const chainRpc: SignHelperChainRpc = {
    getChainId: () => chainId,
    async request(method, params = []) {
      rpcCalls.push({ method, params });
      calls.push(`rpc:${method}`);
      if (method === "eth_sendRawTransaction") {
        return "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
      }
      if (method === "eth_getTransactionCount") {
        return "0x0";
      }
      if (method === "eth_chainId") {
        return chainId;
      }
      if (method === "eth_gasPrice") {
        return "0x3b9aca00";
      }
      if (method === "eth_getBlockByNumber") {
        return {
          baseFeePerGas: "0x7",
          gasLimit: "0x1c9c380",
        };
      }
      if (method === "eth_estimateGas") {
        return "0x5208";
      }
      if (method === "eth_maxPriorityFeePerGas") {
        return "0x1";
      }
      if (method === "eth_feeHistory") {
        return {
          baseFeePerGas: ["0x7", "0x7"],
          gasUsedRatio: [0.5],
          reward: [["0x1"]],
        };
      }
      return null;
    },
  };

  return {
    wallet,
    signer,
    chainRpc,
    calls,
    rpcCalls,
    getHideCount: () => hideCount,
    setCached: (address: EVMAccountAddress | null) => {
      cached = address;
    },
  };
}

const sampleTypedData = {
  types: {
    EIP712Domain: [{ name: "name", type: "string" }],
    Mail: [{ name: "contents", type: "string" }],
  },
  primaryType: "Mail",
  domain: { name: "Test" },
  message: { contents: "hi" },
};

const account = EVMAccountAddress(
  "0x1111111111111111111111111111111111111111",
);

describe("parseTypedData", () => {
  it("parses JSON strings and passes objects through", () => {
    assert.deepEqual(parseTypedData(sampleTypedData), sampleTypedData);
    assert.deepEqual(
      parseTypedData(JSON.stringify(sampleTypedData)),
      sampleTypedData,
    );
  });
});

describe("SignHelper", () => {
  it("personal_sign: display → consent → ensureReady → sign → hide", async () => {
    const { wallet, signer, chainRpc, calls, getHideCount } = createMocks();
    const ensureReadyCalls: string[] = [];
    const authCalls: string[] = [];

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      ensureReady: async () => {
        ensureReadyCalls.push("ensureReady");
      },
      onAuthenticated: async () => {
        authCalls.push("onAuthenticated");
      },
      requestPersonalSignApproval: async (request) => {
        calls.push(`consent:${request.address}:${request.message}`);
        return true;
      },
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    const result = await helper.handlers.personal_sign(["hello", account]);

    assert.equal(result, "0xsig");
    assert.deepEqual(calls, [
      "requestDisplay",
      `consent:${account}:hello`,
      "signMessage:hello",
      "hide",
    ]);
    assert.deepEqual(ensureReadyCalls, ["ensureReady"]);
    assert.deepEqual(authCalls, ["onAuthenticated"]);
    assert.equal(getHideCount(), 1);
  });

  it("personal_sign: rejects without signing when consent is denied", async () => {
    const { wallet, signer, chainRpc, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => false,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    await assert.rejects(
      () => helper.handlers.personal_sign(["hello", account]),
      (error: unknown) => error instanceof OwsUserRejectedError,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("typed data: parses JSON string and signs after consent", async () => {
    const { wallet, signer, chainRpc, calls } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async (request) => {
        calls.push(`typedConsent:${request.typedData.primaryType}`);
        return true;
      },
      requestSendTransactionApproval: async () => true,
    });

    const result = await helper.handlers.eth_signTypedData_v4([
      account,
      JSON.stringify(sampleTypedData),
    ]);

    assert.equal(result, "0xtyped");
    assert.ok(calls.includes("typedConsent:Mail"));
    assert.ok(calls.includes("signTypedData:Mail"));
    assert.ok(calls.includes("hide"));
  });

  it("hides display when ensureReady throws", async () => {
    const { wallet, signer, chainRpc, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      ensureReady: async () => {
        throw new Error("unlock failed");
      },
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    await assert.rejects(
      () => helper.handlers.personal_sign(["hello", account]),
      /unlock failed/,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("eth_sendTransaction: ensureReady → consent → prepare → sign → broadcast", async () => {
    const { wallet, signer, chainRpc, calls, rpcCalls } = createMocks({
      cachedAddress: account,
    });
    const ensureReadyCalls: string[] = [];
    const authCalls: string[] = [];

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      ensureReady: async () => {
        ensureReadyCalls.push("ensureReady");
      },
      onAuthenticated: async () => {
        authCalls.push("onAuthenticated");
      },
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async (request) => {
        calls.push(
          `txConsent:${request.to}:${request.data}:${request.chainId}`,
        );
        return true;
      },
    });

    const to = EVMAccountAddress(
      "0x2222222222222222222222222222222222222222",
    );
    const data = HexString("0xa9059cbb");
    const result = await helper.handlers.eth_sendTransaction([
      { from: account, to, data, value: "0x0" },
    ]);

    assert.equal(
      result,
      EVMTransactionHash(
        "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    );
    assert.deepEqual(ensureReadyCalls, ["ensureReady"]);
    assert.deepEqual(authCalls, ["onAuthenticated"]);
    assert.ok(calls.includes(`txConsent:${to}:${data}:0xaa36a7`));
    assert.ok(calls.includes("signTransaction:11155111"));
    assert.ok(calls.includes("rpc:eth_sendRawTransaction"));
    assert.ok(
      rpcCalls.some((call) => call.method === "eth_sendRawTransaction"),
    );
    assert.ok(calls.includes("hide"));
  });

  it("eth_sendTransaction: rejects without broadcast when consent denied", async () => {
    const { wallet, signer, chainRpc, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => false,
    });

    await assert.rejects(
      () =>
        helper.handlers.eth_sendTransaction([
          {
            from: account,
            to: "0x2222222222222222222222222222222222222222",
            data: "0x",
          },
        ]),
      (error: unknown) => error instanceof OwsUserRejectedError,
    );

    assert.ok(!calls.includes("signTransaction:11155111"));
    assert.ok(!calls.includes("rpc:eth_sendRawTransaction"));
  });

  it("eth_sendTransaction: rejects wrong from account", async () => {
    const { wallet, signer, chainRpc } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    await assert.rejects(
      () =>
        helper.handlers.eth_sendTransaction([
          {
            from: "0x3333333333333333333333333333333333333333",
            to: "0x2222222222222222222222222222222222222222",
            data: "0x",
          },
        ]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("eth_sendTransaction: rejects mismatched chainId", async () => {
    const { wallet, signer, chainRpc } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    await assert.rejects(
      () =>
        helper.handlers.eth_sendTransaction([
          {
            from: account,
            to: "0x2222222222222222222222222222222222222222",
            data: "0x",
            chainId: "0x1",
          },
        ]),
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });

  it("eth_sendTransaction: maps prepare RPC failures", async () => {
    const { wallet, signer, calls } = createMocks({
      cachedAddress: account,
    });
    const chainRpc: SignHelperChainRpc = {
      getChainId: () => EVMChainId("0xaa36a7"),
      async request(method) {
        calls.push(`rpc:${method}`);
        throw new Error("rpc down");
      },
    };

    const helper = new SignHelper(signer, wallet, {
      chainRpc,
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
      requestSendTransactionApproval: async () => true,
    });

    await assert.rejects(
      () =>
        helper.handlers.eth_sendTransaction([
          {
            from: account,
            to: "0x2222222222222222222222222222222222222222",
            data: "0x",
          },
        ]),
      /rpc down/,
    );
    assert.ok(!calls.includes("signTransaction:11155111"));
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVMAccountAddress,
  EVMChainId,
  EVMSignatureHex,
  EVMTransactionHash,
  HexString,
  OwsInvalidParamsError,
  OwsUserRejectedError,
} from "@1shotapi/ows-types";
import {
  SignHelper,
  parseTypedData,
  type SignHelperOptions,
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
      async signMessage(messages) {
        calls.push(`signMessage:${messages[0]}`);
        return [EVMSignatureHex("0xsig")];
      },
      async signTypedData(typedDataList) {
        calls.push(`signTypedData:${typedDataList[0]?.primaryType}`);
        return [EVMSignatureHex("0xtyped")];
      },
      async signTransaction(transactions) {
        calls.push(`signTransaction:${transactions[0]?.chainId}`);
        return [HexString("0xsignedraw")];
      },
    },
  };

  return {
    wallet,
    signer,
    chainId,
    calls,
    getHideCount: () => hideCount,
    setCached: (address: EVMAccountAddress | null) => {
      cached = address;
    },
  };
}

function brandingSignOptions(
  signer: SignHelperSigner,
  calls: string[],
  overrides?: Partial<SignHelperOptions>,
): Pick<
  SignHelperOptions,
  | "approveAndSignPersonalMessage"
  | "approveAndSignTypedData"
  | "approveAndSignTransaction"
> {
  return {
    approveAndSignPersonalMessage: async (request) => {
      calls.push(`consent:${request.address}:${request.message}`);
      const [signature] = await signer.evm.signMessage([request.message]);
      return signature!;
    },
    approveAndSignTypedData: async (request) => {
      calls.push(`typedConsent:${request.typedData.primaryType}`);
      const [signature] = await signer.evm.signTypedData([
        request.typedData as never,
      ]);
      return signature!;
    },
    approveAndSignTransaction: async () => TX_HASH,
    ...overrides,
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

const TX_HASH = EVMTransactionHash(
  "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
  it("personal_sign: display → branding consent+sign → hide", async () => {
    const { wallet, signer, chainId, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls),
    });

    const result = await helper.handlers.personal_sign(["hello", account]);

    assert.equal(result, "0xsig");
    assert.deepEqual(calls, [
      "requestDisplay",
      `consent:${account}:hello`,
      "signMessage:hello",
      "hide",
    ]);
    assert.equal(getHideCount(), 1);
  });

  it("personal_sign: rejects without signing when branding throws", async () => {
    const { wallet, signer, chainId, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls, {
        approveAndSignPersonalMessage: async () => {
          throw new OwsUserRejectedError("User rejected the signing request");
        },
      }),
    });

    await assert.rejects(
      () => helper.handlers.personal_sign(["hello", account]),
      (error: unknown) => error instanceof OwsUserRejectedError,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("typed data: parses JSON string and signs after consent", async () => {
    const { wallet, signer, chainId, calls } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls),
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

  it("hides display when branding approve throws", async () => {
    const { wallet, signer, chainId, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls, {
        approveAndSignPersonalMessage: async () => {
          throw new Error("unlock failed");
        },
      }),
    });

    await assert.rejects(
      () => helper.handlers.personal_sign(["hello", account]),
      /unlock failed/,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("eth_sendTransaction: branding approveAndSignTransaction", async () => {
    const { wallet, signer, chainId, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls, {
        approveAndSignTransaction: async (request) => {
          calls.push(
            `approveAndSign:${request.to}:${request.data}:${request.chainId}`,
          );
          assert.equal(request.address, account);
          assert.ok(request.transaction.from);
          return TX_HASH;
        },
      }),
    });

    const to = EVMAccountAddress(
      "0x2222222222222222222222222222222222222222",
    );
    const data = HexString("0xa9059cbb");
    const result = await helper.handlers.eth_sendTransaction([
      { from: account, to, data, value: "0x0" },
    ]);

    assert.equal(result, TX_HASH);
    assert.ok(calls.includes(`approveAndSign:${to}:${data}:0xaa36a7`));
    assert.ok(!calls.includes("signTransaction:11155111"));
    assert.ok(calls.includes("hide"));
  });

  it("eth_sendTransaction: propagates branding rejection", async () => {
    const { wallet, signer, chainId, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls, {
        approveAndSignTransaction: async () => {
          throw new OwsUserRejectedError(
            "User rejected the transaction request",
          );
        },
      }),
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

    assert.ok(calls.includes("requestDisplay"));
    assert.ok(calls.includes("hide"));
  });

  it("eth_sendTransaction: rejects wrong from account", async () => {
    const { wallet, signer, chainId, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls),
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
    const { wallet, signer, chainId, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls),
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

  it("eth_sendTransaction: rejects invalid hash from branding", async () => {
    const { wallet, signer, chainId, calls } = createMocks({
      cachedAddress: account,
    });

    const helper = new SignHelper(signer, wallet, {
      getChainId: () => chainId,
      ...brandingSignOptions(signer, calls, {
        approveAndSignTransaction: async () => "not-a-hash" as never,
      }),
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
      (error: unknown) => error instanceof OwsInvalidParamsError,
    );
  });
});

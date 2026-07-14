import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  EVMAccountAddress,
  OwsUserRejectedError,
} from "@1shotapi/ows-types";
import {
  SignHelper,
  parseTypedData,
  type SignHelperSigner,
  type SignHelperWallet,
} from "../src/eip1193/sign-helper.ts";

function createMocks() {
  const calls: string[] = [];
  let hideCount = 0;

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
    evm: {
      async signMessage({ message }) {
        calls.push(`signMessage:${message}`);
        return "0xsig";
      },
      async signTypedData(typedData) {
        calls.push(`signTypedData:${typedData.primaryType}`);
        return "0xtyped";
      },
    },
  };

  return { wallet, signer, calls, getHideCount: () => hideCount };
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
    const { wallet, signer, calls, getHideCount } = createMocks();
    const ensureReadyCalls: string[] = [];

    const helper = new SignHelper(signer, wallet, {
      ensureReady: async () => {
        ensureReadyCalls.push("ensureReady");
      },
      requestPersonalSignApproval: async (request) => {
        calls.push(`consent:${request.address}:${request.message}`);
        return true;
      },
      requestSignTypedDataApproval: async () => true,
    });

    const address = EVMAccountAddress(
      "0x1111111111111111111111111111111111111111",
    );
    const result = await helper.handlers.personal_sign(["hello", address]);

    assert.equal(result, "0xsig");
    assert.deepEqual(calls, [
      "requestDisplay",
      `consent:${address}:hello`,
      "signMessage:hello",
      "hide",
    ]);
    assert.deepEqual(ensureReadyCalls, ["ensureReady"]);
    assert.equal(getHideCount(), 1);
  });

  it("personal_sign: rejects without signing when consent is denied", async () => {
    const { wallet, signer, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      requestPersonalSignApproval: async () => false,
      requestSignTypedDataApproval: async () => true,
    });

    await assert.rejects(
      () =>
        helper.handlers.personal_sign([
          "hello",
          "0x1111111111111111111111111111111111111111",
        ]),
      (error: unknown) => error instanceof OwsUserRejectedError,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("typed data: parses JSON string and signs after consent", async () => {
    const { wallet, signer, calls } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async (request) => {
        calls.push(`typedConsent:${request.typedData.primaryType}`);
        return true;
      },
    });

    const result = await helper.handlers.eth_signTypedData_v4([
      "0x1111111111111111111111111111111111111111",
      JSON.stringify(sampleTypedData),
    ]);

    assert.equal(result, "0xtyped");
    assert.ok(calls.includes("typedConsent:Mail"));
    assert.ok(calls.includes("signTypedData:Mail"));
    assert.ok(calls.includes("hide"));
  });

  it("hides display when ensureReady throws", async () => {
    const { wallet, signer, calls, getHideCount } = createMocks();

    const helper = new SignHelper(signer, wallet, {
      ensureReady: async () => {
        throw new Error("unlock failed");
      },
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
    });

    await assert.rejects(
      () =>
        helper.handlers.personal_sign([
          "hello",
          "0x1111111111111111111111111111111111111111",
        ]),
      /unlock failed/,
    );

    assert.deepEqual(calls, ["requestDisplay", "hide"]);
    assert.equal(getHideCount(), 1);
  });

  it("exposes the same handler for all typed-data method aliases", () => {
    const { wallet, signer } = createMocks();
    const helper = new SignHelper(signer, wallet, {
      requestPersonalSignApproval: async () => true,
      requestSignTypedDataApproval: async () => true,
    });

    assert.equal(
      helper.handlers.eth_signTypedData,
      helper.handlers.eth_signTypedData_v3,
    );
    assert.equal(
      helper.handlers.eth_signTypedData_v3,
      helper.handlers.eth_signTypedData_v4,
    );
  });
});

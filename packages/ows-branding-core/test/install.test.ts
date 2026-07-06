import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DisplayRequestId, EVMSignatureHex } from "@1shotapi/ows-types";
import { installBrandingModules } from "../src/install.ts";
import type { BrandingContext, BrandingModule } from "../src/types.ts";

function createTestContext(
  overrides: Partial<BrandingContext> = {},
): BrandingContext {
  return {
    wallet: {
      registerEip1193: () => {},
      requestDisplay: async () => ({
        displayId: DisplayRequestId("test"),
        release: () => {},
        hide: async () => {},
      }),
      requestHide: async () => {},
    },
    signer: {
      evm: {
        signMessage: async () => EVMSignatureHex("0x"),
        signTypedData: async () => EVMSignatureHex("0x"),
      },
      createRecoveryData: async () => ({ encryptedPrivateKey: "ows1:0x" }),
      recoverKey: async () => {},
    },

    ...overrides,
  };
}

describe("installBrandingModules", () => {
  it("runs pre-start modules only when phase is pre-start", async () => {
    const order: string[] = [];

    const preStart: BrandingModule = {
      name: "pre",
      phase: "pre-start",
      install: () => {
        order.push("pre");
      },
    };

    const postStart: BrandingModule = {
      name: "post",
      phase: "post-start",
      install: () => {
        order.push("post");
      },
    };

    await installBrandingModules(
      createTestContext(),
      [preStart, postStart],
      "pre-start",
    );
    assert.deepEqual(order, ["pre"]);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EVMChainId,
  EVMAccountAddress,
  IAppendedCaveatConfiguration,
  IExecutionPermissionRequest,
} from "../src/index.ts";

describe("IExecutionPermissionRequest caveats", () => {
  it("accepts an optional caveats array of IAppendedCaveatConfiguration", () => {
    const request: IExecutionPermissionRequest = {
      chainId: "0x2105" as EVMChainId,
      to: "0x1111111111111111111111111111111111111111" as EVMAccountAddress,
      permission: {
        type: "erc20-token-periodic",
        isAdjustmentAllowed: false,
        data: {},
      },
      caveats: [
        {
          type: "allowedCalldata",
          data: { startIndex: 4, value: "0xdeadbeef" },
        },
        {
          type: "limitedCalls",
          data: { limit: 3 },
        },
      ],
    };
    assert.equal(request.caveats?.length, 2);
    assert.equal(request.caveats?.[0]?.type, "allowedCalldata");
  });

  it("is valid without caveats (backwards compatible)", () => {
    const request: IExecutionPermissionRequest = {
      chainId: "0x2105" as EVMChainId,
      to: "0x1111111111111111111111111111111111111111" as EVMAccountAddress,
      permission: {
        type: "erc20-token-periodic",
        isAdjustmentAllowed: false,
        data: {},
      },
    };
    assert.equal(request.caveats, undefined);
  });

  it("IAppendedCaveatConfiguration carries type + data", () => {
    const caveat: IAppendedCaveatConfiguration = {
      type: "redeemer",
      data: { redeemers: ["0x" + "2".repeat(40)] },
    };
    assert.equal(caveat.type, "redeemer");
    assert.ok(typeof caveat.data === "object");
  });
});

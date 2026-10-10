import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  EVMChainId,
  EVMAccountAddress,
  IAppendedCaveatConfiguration,
  IExecutionPermissionRequest,
  IExecutionPermissionRule,
} from "../src/index.ts";

describe("IExecutionPermissionRequest rules", () => {
  it("accepts an optional rules array of IExecutionPermissionRule", () => {
    const request: IExecutionPermissionRequest = {
      chainId: "0x2105" as EVMChainId,
      to: "0x1111111111111111111111111111111111111111" as EVMAccountAddress,
      permission: {
        type: "erc20-token-periodic",
        isAdjustmentAllowed: false,
        data: {},
      },
      rules: [
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
    assert.equal(request.rules?.length, 2);
    assert.equal(request.rules?.[0]?.type, "allowedCalldata");
  });

  it("is valid without rules", () => {
    const request: IExecutionPermissionRequest = {
      chainId: "0x2105" as EVMChainId,
      to: "0x1111111111111111111111111111111111111111" as EVMAccountAddress,
      permission: {
        type: "erc20-token-periodic",
        isAdjustmentAllowed: false,
        data: {},
      },
    };
    assert.equal(request.rules, undefined);
  });

  it("IAppendedCaveatConfiguration is the same shape as IExecutionPermissionRule", () => {
    const rule: IExecutionPermissionRule = {
      type: "redeemer",
      data: { redeemers: ["0x" + "2".repeat(40)] },
    };
    const caveat: IAppendedCaveatConfiguration = rule;
    assert.equal(caveat.type, "redeemer");
    assert.ok(typeof caveat.data === "object");
  });
});

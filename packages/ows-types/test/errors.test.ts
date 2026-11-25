import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  OwsInvalidParamsError,
  OwsRpcError,
  OwsUserRejectedError,
  RPC_ERROR_INVALID_PARAMS,
  RPC_ERROR_USER_REJECTED,
} from "../src/index.js";

describe("OwsRpcError", () => {
  it("roundtrips via toPayload/fromPayload", () => {
    const error = new OwsInvalidParamsError("bad params", { field: "x" });
    const restored = OwsRpcError.fromPayload(error.toPayload());
    assert.ok(restored instanceof OwsInvalidParamsError);
    assert.equal(restored.code, RPC_ERROR_INVALID_PARAMS);
    assert.deepEqual(restored.data, { field: "x" });
  });

  it("restores user rejected errors", () => {
    const error = new OwsUserRejectedError();
    const restored = OwsRpcError.fromPayload(error.toPayload());
    assert.ok(restored instanceof OwsUserRejectedError);
    assert.equal(restored.code, RPC_ERROR_USER_REJECTED);
  });
});

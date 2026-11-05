import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OWSProxy } from "../src/index.ts";

describe("@1shotapi/ows-provider exports", () => {
  it("exports OWSProxy factory", () => {
    assert.equal(typeof OWSProxy.create, "function");
  });
});

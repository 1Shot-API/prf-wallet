import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createOwsProvider } from "../src/index.ts";

describe("@1shotapi/ows-provider", () => {
  it("exports createOwsProvider", () => {
    assert.equal(typeof createOwsProvider, "function");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OWSWallet } from "../src/index.ts";

describe("@1shotapi/ows-wallet-utils exports", () => {
  it("exports OWSWallet factory", () => {
    assert.equal(typeof OWSWallet.create, "function");
    assert.equal(typeof OWSWallet.prepare, "function");
  });
});

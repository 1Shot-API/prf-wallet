import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OwsWalletChild, OwsWalletParent } from "../src/index.ts";

describe("@1shotapi/ows-wallet-utils", () => {
  it("exports wallet parent and child placeholders", () => {
    assert.equal(typeof OwsWalletParent.connect, "function");
    assert.equal(typeof OwsWalletChild.handshake, "function");
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OwsSignerHost } from "../src/index.ts";

describe("@1shotapi/ows-signer-utils", () => {
  it("constructs a signer host placeholder", () => {
    const host = new OwsSignerHost({ signerUrl: "https://example.com/signer" });
    assert.ok(host.evm);
  });
});

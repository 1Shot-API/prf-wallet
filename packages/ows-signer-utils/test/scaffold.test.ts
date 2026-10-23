import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OWSSigner } from "../src/index.ts";

describe("@1shotapi/ows-signer-utils exports", () => {
  it("exports OWSSigner factory class", () => {
    assert.equal(typeof OWSSigner.create, "function");
  });
});

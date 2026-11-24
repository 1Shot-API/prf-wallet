import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { OWSProxy, OWSProxyCore } from "../src/index.ts";
import * as evm from "../src/evm.ts";

describe("@1shotapi/ows-provider exports", () => {
  it("exports OWSProxy factory", () => {
    assert.equal(typeof OWSProxy.create, "function");
  });

  it("OWSProxy extends OWSProxyCore", () => {
    assert.equal(Object.getPrototypeOf(OWSProxy), OWSProxyCore);
  });
});

describe("@1shotapi/ows-provider/evm exports", () => {
  it("exports the EVM-only proxy and provider", () => {
    assert.equal(typeof evm.OWSProxyCore.create, "function");
    assert.equal(typeof evm.EIP1193Provider, "function");
    assert.equal(typeof evm.EWalletPresentationMode, "object");
  });

  it("does not export the multi-chain proxy or Solana / credentials clients", () => {
    assert.equal("OWSProxy" in evm, false);
    assert.equal("SolanaHostClient" in evm, false);
    assert.equal("CredentialHostClient" in evm, false);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { keccak256, stringToHex, toFunctionSelector } from "viem";
import { EVMChainId, EVMContractAddress, HexString } from "@1shotapi/ows-types";
import { ClearSigningUtils } from "../src/index.js";
import {
  ClearSigningPath,
  EClearSigningPathRoot,
  EClearSigningPathTokenKind,
} from "../src/ClearSigningPath.js";

const PERMIT_TYPES = {
  EIP712Domain: [
    { name: "name", type: "string" },
    { name: "version", type: "string" },
    { name: "chainId", type: "uint256" },
    { name: "verifyingContract", type: "address" },
  ],
  Permit: [
    { name: "owner", type: "address" },
    { name: "spender", type: "address" },
    { name: "value", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};

describe("ClearSigningUtils", () => {
  it("builds calldata lookup keys", () => {
    const key = ClearSigningUtils.calldataLookupKey(
      EVMChainId("0x1"),
      EVMContractAddress("0x111111125421cA6dc452d289314280a0f8842A65"),
      HexString("0xA9059CBB000000"),
    );
    assert.equal(key?.selector, "0xa9059cbb");
    assert.equal(
      ClearSigningUtils.calldataLookupKey(EVMChainId("0x1"), EVMContractAddress("0x111111125421cA6dc452d289314280a0f8842A65"), HexString("0x")),
      null,
    );
  });

  it("computes encodeType with sorted dependencies", () => {
    const types = {
      Mail: [
        { name: "from", type: "Person" },
        { name: "to", type: "Person" },
        { name: "contents", type: "string" },
      ],
      Person: [
        { name: "name", type: "string" },
        { name: "wallet", type: "address" },
      ],
    };
    assert.equal(
      ClearSigningUtils.encodeType(types, "Mail"),
      "Mail(Person from,Person to,string contents)Person(string name,address wallet)",
    );
  });

  it("matches the registry encodeTypeHash for ERC-2612 Permit", () => {
    const key = ClearSigningUtils.eip712LookupKey({
      types: PERMIT_TYPES,
      primaryType: "Permit",
      domain: {
        name: "USD Coin",
        version: "2",
        chainId: 10,
        verifyingContract: "0x0b2c639c533813f4aa9d7837caf62653d097ff85",
      },
      message: {},
    });
    assert.ok(key);
    assert.equal(key.chainId, "0xa");
    assert.equal(key.verifyingContract, "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85");
    // Value from index.eip712.json for eip155:10:0x0b2c…ff85 / Permit.
    assert.equal(
      key.encodeTypeHash,
      "0x6e71edae12b1b97f4d1f60370fef10105fa2faae0126114a169c64845d6126c9",
    );
  });

  it("returns null for EIP-712 messages without a verifying contract", () => {
    assert.equal(
      ClearSigningUtils.eip712LookupKey({
        types: PERMIT_TYPES,
        primaryType: "Permit",
        domain: { name: "x", chainId: 1 },
        message: {},
      }),
      null,
    );
  });

  it("derives selectors from named fragments, including spaced registry keys", () => {
    const key =
      "clipperSwap(address clipperExchange, uint256 srcToken, address dstToken, uint256 inputAmount, uint256 outputAmount, uint256 goodUntil, bytes32 r, bytes32 vs)";
    assert.equal(
      ClearSigningUtils.selectorForFunctionKey(key),
      toFunctionSelector("clipperSwap(address,uint256,address,uint256,uint256,uint256,bytes32,bytes32)"),
    );
    assert.equal(
      ClearSigningUtils.selectorForFunctionKey(
        "submitOrder((address token,uint256 amount,uint256 price) order,bytes32 salt)",
      ),
      keccak256(stringToHex("submitOrder((address,uint256,uint256),bytes32)")).slice(0, 10),
    );
  });
});

describe("ClearSigningPath", () => {
  it("parses roots, slices, indices and full-array selectors", () => {
    const slice = ClearSigningPath.parse("srcToken.[-20:]");
    assert.equal(slice.root, EClearSigningPathRoot.Relative);
    assert.deepEqual(slice.tokens, [
      { kind: EClearSigningPathTokenKind.Name, name: "srcToken" },
      { kind: EClearSigningPathTokenKind.Slice, start: -20, end: undefined },
    ]);
    assert.equal(ClearSigningPath.parse("@.to").root, EClearSigningPathRoot.Container);
    assert.equal(ClearSigningPath.parse("$.metadata.enums.x").root, EClearSigningPathRoot.Descriptor);
    assert.deepEqual(ClearSigningPath.parse("#.details.[]").tokens, [
      { kind: EClearSigningPathTokenKind.Name, name: "details" },
      { kind: EClearSigningPathTokenKind.All },
    ]);
    assert.deepEqual(ClearSigningPath.parse("recipients[0]").tokens, [
      { kind: EClearSigningPathTokenKind.Name, name: "recipients" },
      { kind: EClearSigningPathTokenKind.Index, index: 0 },
    ]);
    assert.throws(() => ClearSigningPath.parse("a..b"));
  });
});

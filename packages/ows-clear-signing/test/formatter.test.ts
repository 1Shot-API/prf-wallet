import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { encodeFunctionData, parseAbiItem } from "viem";
import { EVMChainId, EVMContractAddress, HexString } from "@1shotapi/ows-types";
import {
  ClearSigningError,
  ClearSigningFormatter,
  EClearSigningDisplayKind,
  type IClearSigningTypedData,
} from "../src/index.js";
import {
  BASE,
  ONEINCH,
  SIGNER,
  TestEnvironment,
  USDC_BASE,
  USDC_OPTIMISM,
  descriptorFrom,
  loadDescriptor,
} from "./helpers.js";

const ETH = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const SPENDER = "0x2222222222222222222222222222222222222222";
const JAN_1_2026 = 1767225600n;

function clipperSwapCalldata(): HexString {
  const fn = parseAbiItem(
    "function clipperSwap(address clipperExchange, uint256 srcToken, address dstToken, uint256 inputAmount, uint256 outputAmount, uint256 goodUntil, bytes32 r, bytes32 vs)",
  );
  // 1inch packs flags into the high bits of srcToken / goodUntil; the descriptor slices them off.
  const srcToken = (1n << 255n) | BigInt(USDC_BASE);
  const goodUntil = (0xabcdn << 64n) | JAN_1_2026;
  return HexString(
    encodeFunctionData({
      abi: [fn],
      args: [
        "0x3333333333333333333333333333333333333333",
        srcToken,
        ETH,
        1_500_250_000n,
        420_000_000_000_000_000n,
        goodUntil,
        `0x${"11".repeat(32)}`,
        `0x${"22".repeat(32)}`,
      ],
    }),
  );
}

function permit(overrides: Partial<IClearSigningTypedData> = {}, value = 25_000_000n): IClearSigningTypedData {
  return {
    types: {
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
    },
    primaryType: "Permit",
    domain: { name: "USD Coin", version: "2", chainId: 10, verifyingContract: USDC_OPTIMISM },
    message: {
      owner: SIGNER,
      spender: SPENDER,
      value: value.toString(),
      nonce: "7",
      deadline: JAN_1_2026.toString(),
    },
    ...overrides,
  };
}

describe("ClearSigningFormatter — calldata", () => {
  const formatter = new ClearSigningFormatter(new TestEnvironment());
  const descriptor = loadDescriptor("resolved-1inch-clipperSwap.json");

  it("renders a 1inch clipperSwap with slices, native currency and container paths", async () => {
    const display = await formatter.formatCalldata(descriptor, {
      chainId: BASE,
      from: SIGNER,
      to: ONEINCH,
      data: clipperSwapCalldata(),
      value: HexString("0x0"),
    });
    assert.equal(display.intent, "Swap");
    assert.equal(display.owner, "1inch Network");
    assert.equal(display.contractName, "AggregationRouterV6");
    assert.deepEqual(
      display.fields.map((f) => [f.label, f.value]),
      [
        ["Amount to Send", "1,500.25 USDC"],
        ["Minimum to Receive", "0.42 ETH"],
        ["Beneficiary", "You"],
        ["Expiration time", "2026-01-01 00:00:00 UTC"],
      ],
    );
    assert.equal(display.fields[0].kind, EClearSigningDisplayKind.TokenAmount);
    assert.equal(display.fields[0].tokenAddress, USDC_BASE);
    assert.equal(display.fields[1].kind, EClearSigningDisplayKind.NativeAmount);
    assert.equal(display.fields[2].address, SIGNER);
  });

  it("rejects a descriptor not bound to the transaction's chain/contract", async () => {
    await assert.rejects(
      formatter.formatCalldata(descriptor, {
        chainId: EVMChainId("0x89"),
        from: SIGNER,
        to: ONEINCH,
        data: clipperSwapCalldata(),
        value: HexString("0x0"),
      }),
      ClearSigningError,
    );
  });

  it("rejects calldata whose selector differs from the served format", async () => {
    await assert.rejects(
      formatter.formatCalldata(descriptor, {
        chainId: BASE,
        from: SIGNER,
        to: ONEINCH,
        data: HexString(`0xa9059cbb${"00".repeat(64)}`),
        value: HexString("0x0"),
      }),
      /does not match calldata selector/,
    );
  });

  it("formats enums, interpolated intents, unknown tokens and thresholds", async () => {
    const lending = EVMContractAddress("0x4444444444444444444444444444444444444444");
    const unknownToken = "0x5555555555555555555555555555555555555555";
    const repay = descriptorFrom({
      context: { contract: { deployments: [{ chainId: 8453, address: lending }] } },
      metadata: {
        enums: { interestRateMode: { "1": "stable", "2": "variable" } },
        maps: { underlying: { values: { "8453": USDC_BASE } } },
      },
      format: {
        key: "repay(address asset,uint256 amount,uint256 interestRateMode,uint256 cap)",
        intent: { Action: "Repay", Market: "Main" },
        interpolatedIntent: "Repay {amount} of {interestRateMode} rate loan",
        fields: [
          { path: "amount", label: "Amount", format: "tokenAmount", params: { tokenPath: "asset" } },
          { path: "interestRateMode", label: "Mode", format: "enum", params: { $ref: "$.metadata.enums.interestRateMode" } },
          {
            path: "cap",
            label: "Cap",
            format: "tokenAmount",
            params: { token: { map: "$.metadata.maps.underlying", keyPath: "@.chainId" }, threshold: "0xffffffff" },
          },
        ],
      },
    });
    const fn = parseAbiItem("function repay(address asset,uint256 amount,uint256 interestRateMode,uint256 cap)");
    const call = (asset: string) =>
      formatter.formatCalldata(repay, {
        chainId: BASE,
        from: SIGNER,
        to: lending,
        data: HexString(encodeFunctionData({ abi: [fn], args: [asset as `0x${string}`, 2_000_000n, 2n, 2n ** 64n] })),
        value: HexString("0x0"),
      });

    const known = await call(USDC_BASE);
    assert.equal(known.intent, "Repay · Main");
    assert.deepEqual(known.intentDetails, [
      { label: "Action", value: "Repay" },
      { label: "Market", value: "Main" },
    ]);
    assert.equal(known.interpolatedIntent, "Repay 2 USDC of variable rate loan");
    assert.deepEqual(known.fields.map((f) => f.value), ["2 USDC", "variable", "Unlimited USDC"]);

    const unknown = await call(unknownToken);
    assert.equal(unknown.fields[0].value, "2,000,000");
    assert.equal(unknown.fields[0].warning, "Unknown token");
  });

  it("iterates arrays in groups and fails closed on mustMatch", async () => {
    const batch = EVMContractAddress("0x6666666666666666666666666666666666666666");
    const fn = parseAbiItem("function payAll((address to,uint256 amount)[] payments,uint8 mode)");
    const descriptor = (mustMatch: number[]) =>
      descriptorFrom({
        context: { contract: { deployments: [{ chainId: 8453, address: batch }] } },
        metadata: {},
        format: {
          key: "payAll((address to,uint256 amount)[] payments,uint8 mode)",
          intent: "Pay",
          fields: [
            {
              path: "payments.[]",
              fields: [
                { path: "to", label: "Recipient", format: "addressName" },
                { path: "amount", label: "Amount", format: "amount" },
              ],
            },
            { path: "mode", visible: { mustMatch } },
          ],
        },
      });
    const tx = {
      chainId: BASE,
      from: SIGNER,
      to: batch,
      data: HexString(
        encodeFunctionData({
          abi: [fn],
          args: [[
            { to: SPENDER, amount: 10n ** 18n },
            { to: SIGNER, amount: 5n * 10n ** 17n },
          ], 1],
        }),
      ),
      value: HexString("0x0"),
    };
    const display = await formatter.formatCalldata(descriptor([1]), tx);
    assert.deepEqual(
      display.fields.map((f) => [f.label, f.value]),
      [
        ["Recipient (1)", SPENDER],
        ["Amount (1)", "1 ETH"],
        ["Recipient (2)", "You"],
        ["Amount (2)", "0.5 ETH"],
      ],
    );
    await assert.rejects(formatter.formatCalldata(descriptor([0]), tx), /mustMatch/);
  });
});

describe("ClearSigningFormatter — EIP-712", () => {
  const formatter = new ClearSigningFormatter(new TestEnvironment());
  const descriptor = loadDescriptor("resolved-usdc-permit-optimism.json");

  it("renders a USDC Permit", async () => {
    const display = await formatter.formatTypedData(descriptor, permit(), SIGNER);
    assert.equal(display.intent, "Authorize spending of tokens");
    assert.equal(display.owner, "USD Coin");
    assert.deepEqual(
      display.fields.map((f) => [f.label, f.value]),
      [
        ["Spender", SPENDER],
        ["Max spending amount", "25 USDC"],
        ["Valid until", "2026-01-01 00:00:00 UTC"],
        ["Owner", "You"],
      ],
    );
  });

  it("applies the unlimited threshold", async () => {
    const display = await formatter.formatTypedData(descriptor, permit({}, 2n ** 256n - 1n), SIGNER);
    assert.equal(display.fields[1].value, "Unlimited USDC");
  });

  it("rejects domain, deployment and type mismatches", async () => {
    await assert.rejects(
      formatter.formatTypedData(
        descriptor,
        permit({ domain: { name: "USD Coin Fake", version: "2", chainId: 10, verifyingContract: USDC_OPTIMISM } }),
        SIGNER,
      ),
      /domain name/,
    );
    await assert.rejects(
      formatter.formatTypedData(
        descriptor,
        permit({ domain: { name: "USD Coin", version: "2", chainId: 10, verifyingContract: USDC_BASE } }),
        SIGNER,
      ),
      /not bound/,
    );
    const types = permit().types;
    await assert.rejects(
      formatter.formatTypedData(
        descriptor,
        permit({ types: { ...types, Permit: [...types.Permit, { name: "extra", type: "uint256" }] } }),
        SIGNER,
      ),
      /does not match EIP-712 type/,
    );
    await assert.rejects(
      formatter.formatTypedData(descriptor, permit({ domain: { name: "USD Coin", version: "2" } }), SIGNER),
      /lacks chainId/,
    );
  });
});

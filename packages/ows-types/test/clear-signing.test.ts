import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ClearSigningLookupResultSchema,
  EClearSigningFieldFormat,
  EIP712EncodeTypeHashSchema,
  EIP712TypeNameSchema,
  EVMFunctionSelectorSchema,
} from "../src/index.ts";

describe("clear-signing primitives and schemas", () => {
  it("normalizes selectors and type hashes to lowercase", () => {
    assert.equal(EVMFunctionSelectorSchema.parse("0xA9059CBB"), "0xa9059cbb");
    assert.equal(EVMFunctionSelectorSchema.safeParse("0xa9059c").success, false);
    assert.equal(
      EIP712EncodeTypeHashSchema.parse(`0x${"AB".repeat(32)}`),
      `0x${"ab".repeat(32)}`,
    );
    assert.equal(EIP712TypeNameSchema.safeParse("Permit(address)").success, false);
  });

  it("parses a Relayer miss and a resolved hit", () => {
    assert.deepEqual(ClearSigningLookupResultSchema.parse({ found: false }), { found: false });
    const hit = ClearSigningLookupResultSchema.parse({
      found: true,
      registrySha: "0123456789ABCDEF0123456789abcdef01234567",
      path: "registry/x/calldata-X.json",
      descriptor: {
        context: {
          contract: {
            deployments: [{ chainId: 8453, address: "0x111111125421ca6dc452d289314280a0f8842a65" }],
          },
        },
        metadata: { owner: "X" },
        format: {
          key: "transfer(address to,uint256 value)",
          intent: "Send",
          fields: [
            { path: "value", format: "tokenAmount", params: { tokenPath: "@.to" } },
            { path: "to", format: "someFutureFormat" },
            { path: "items.[]", fields: [{ path: "id", label: "Id" }] },
          ],
        },
      },
    });
    assert.ok(hit.found);
    assert.equal(hit.registrySha, "0123456789abcdef0123456789abcdef01234567");
    const deployment = hit.descriptor.context.contract!.deployments[0];
    assert.equal(deployment.chainId, "0x2105");
    assert.equal(deployment.address, "0x111111125421cA6dc452d289314280a0f8842A65");
    assert.equal(hit.descriptor.format.fields[1].format, EClearSigningFieldFormat.Raw);
    assert.equal(hit.descriptor.format.fields[2].fields?.[0].label, "Id");
  });

  it("rejects malformed responses", () => {
    assert.equal(ClearSigningLookupResultSchema.safeParse({ found: true }).success, false);
    assert.equal(ClearSigningLookupResultSchema.safeParse({}).success, false);
  });
});

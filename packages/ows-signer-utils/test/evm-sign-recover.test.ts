import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  hashMessage,
  hashTypedData,
  parseSignature,
  recoverAddress,
  recoverMessageAddress,
  recoverTypedDataAddress,
  serializeSignature,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { publicKeyToAddress } from "viem/utils";
import { signWithScheme } from "../../ows-signer/src/crypto/sign.js";
import { getPublicKey } from "../../ows-signer/src/crypto/vendor/noble-secp256k1.js";
import { parse0xHex, to0xHex } from "../../ows-signer/src/hex.js";
import {
  digestForMessage,
  digestForTypedData,
} from "../src/evm/marshal.ts";

describe("evm recoverable signatures", () => {
  it("signWithScheme matches viem privateKeyToAccount for personal_sign", async () => {
    const privateKey = generatePrivateKey();
    const privBytes = parse0xHex(privateKey);
    const account = privateKeyToAccount(privateKey);
    const message = "ows recoverable v-byte check";

    const digest = digestForMessage(message);
    assert.equal(digest, hashMessage(message));

    const owsSig = await signWithScheme(
      "secp256k1-ecdsa-recoverable",
      parse0xHex(digest),
      privBytes,
      new Uint8Array(32),
    );
    const viemSig = await account.signMessage({ message });

    const v = Number.parseInt(owsSig.slice(-2), 16);
    assert.ok(v === 27 || v === 28, `ows v must be 27|28, got ${v}`);

    assert.equal(
      await recoverMessageAddress({ message, signature: owsSig }),
      account.address,
    );
    assert.equal(
      await recoverMessageAddress({ message, signature: viemSig }),
      account.address,
    );

    // Same digest + key ⇒ same r/s (RFC6979); v may differ only if recovery encoding differed.
    assert.equal(owsSig.slice(0, -2), viemSig.slice(0, -2));
  });

  it("signWithScheme matches viem for EIP-712 typed data", async () => {
    const privateKey = generatePrivateKey();
    const privBytes = parse0xHex(privateKey);
    const account = privateKeyToAccount(privateKey);

    const typedData = {
      domain: {
        name: "DelegationManager",
        version: "1",
        chainId: 84532,
        verifyingContract:
          "0x0000000000000000000000000000000000000001" as const,
      },
      types: {
        Mail: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "contents", type: "string" },
        ],
      },
      primaryType: "Mail" as const,
      message: {
        from: account.address,
        to: "0x0000000000000000000000000000000000000002" as const,
        contents: "delegation",
      },
    };

    const digest = digestForTypedData(typedData);
    assert.equal(digest, hashTypedData(typedData));

    const owsSig = await signWithScheme(
      "secp256k1-ecdsa-recoverable",
      parse0xHex(digest),
      privBytes,
      new Uint8Array(32),
    );
    const viemSig = await account.signTypedData(typedData);

    const v = Number.parseInt(owsSig.slice(-2), 16);
    assert.ok(v === 27 || v === 28, `ows v must be 27|28, got ${v}`);

    assert.equal(
      await recoverTypedDataAddress({ ...typedData, signature: owsSig }),
      account.address,
    );
    assert.equal(
      await recoverTypedDataAddress({ ...typedData, signature: viemSig }),
      account.address,
    );
    assert.equal(
      await recoverAddress({ hash: digest, signature: owsSig }),
      account.address,
    );
  });

  it("serializeSignature upgrades yParity 0/1 to v 27/28", () => {
    const yParitySig =
      (`0x${"11".repeat(32)}${"22".repeat(32)}01`) as `0x${string}`;
    const canonical = serializeSignature(parseSignature(yParitySig));
    assert.equal(canonical.slice(-2), "1c");
  });

  it("recovered address matches noble public key", async () => {
    const privBytes = parse0xHex(
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
    );
    const pub = getPublicKey(privBytes, false);
    const expected = publicKeyToAddress(to0xHex(pub) as `0x${string}`);
    const digest = hashMessage("hello ows");
    const sig = await signWithScheme(
      "secp256k1-ecdsa-recoverable",
      parse0xHex(digest),
      privBytes,
      new Uint8Array(32),
    );
    assert.equal(
      await recoverAddress({ hash: digest, signature: sig }),
      expected,
    );
  });
});

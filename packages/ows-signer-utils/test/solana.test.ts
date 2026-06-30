import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { addressFromEd25519PublicKey } from "../src/solana/address.js";

describe("solana address", () => {
  it("base58-encodes 32-byte ed25519 public key", () => {
    const pubkey =
      "0x0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20" as const;
    assert.equal(
      addressFromEd25519PublicKey(pubkey),
      "4wBqpZM9xaSheZzJSMawUKKwhdpChKbZ5eu5ky4Vigw",
    );
  });
});

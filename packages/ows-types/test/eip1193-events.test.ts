import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deserializeEip1193EventNotification,
  serializeRpc,
} from "../src/index.js";

describe("deserializeEip1193EventNotification", () => {
  it("round-trips chainChanged via serializeRpc", () => {
    const payload = {
      event: "chainChanged",
      params: ["0x2105"],
    };
    const notification = deserializeEip1193EventNotification(
      serializeRpc(payload),
    );
    assert.equal(notification.event, "chainChanged");
    assert.deepEqual(notification.params, ["0x2105"]);
  });

  it("accepts an already-parsed object", () => {
    const notification = deserializeEip1193EventNotification({
      event: "accountsChanged",
      params: [["0xabc"]],
    });
    assert.equal(notification.event, "accountsChanged");
    assert.deepEqual(notification.params, [["0xabc"]]);
  });

  it("rejects missing event or params", () => {
    assert.throws(() =>
      deserializeEip1193EventNotification({ event: "chainChanged" }),
    );
    assert.throws(() =>
      deserializeEip1193EventNotification({ params: ["0x1"] }),
    );
  });
});

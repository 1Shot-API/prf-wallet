import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AnalyticsEventId,
  DomainString,
  OWSAnalyticsEvent,
  UnixTimestamp,
  deserializeAnalyticsEvent,
  serializeRpc,
  type IOWSAnalyticsEvent,
} from "../src/index.js";

/** Concrete subclass for constructing base events in tests. */
class TestAnalyticsEvent extends OWSAnalyticsEvent {}

describe("OWSAnalyticsEvent", () => {
  it("mints eventId and timestamp", () => {
    const event = new TestAnalyticsEvent("AccountCreated", "app.example.com");
    assert.equal(event.name, "AccountCreated");
    assert.equal(event.hostDomain, DomainString("app.example.com"));
    assert.equal(typeof event.eventId, "string");
    assert.ok(event.eventId.length > 0);
    assert.equal(typeof event.timestamp, "number");
  });

  it("accepts explicit eventId and timestamp", () => {
    const event = new TestAnalyticsEvent("AccountCreated", "app.example.com", {
      eventId: "11111111-1111-4111-8111-111111111111",
      timestamp: 1_719_792_000,
    });
    assert.equal(
      event.eventId,
      AnalyticsEventId("11111111-1111-4111-8111-111111111111"),
    );
    assert.equal(event.timestamp, UnixTimestamp(1_719_792_000));
  });

  it("serializes subclass fields for the wire", () => {
    class AccountCreatedEvent extends OWSAnalyticsEvent {
      readonly accountAddress: string;
      constructor(hostDomain: string, accountAddress: string) {
        super("AccountCreated", hostDomain);
        this.accountAddress = accountAddress;
      }
    }

    const event = new AccountCreatedEvent("app.example.com", "0xabc");
    const roundTrip = deserializeAnalyticsEvent(serializeRpc(event));
    assert.equal(roundTrip.name, "AccountCreated");
    assert.equal(roundTrip.accountAddress, "0xabc");
    assert.equal(roundTrip.hostDomain, DomainString("app.example.com"));
  });
});

describe("deserializeAnalyticsEvent", () => {
  it("brands base fields and preserves rich extras", () => {
    const raw = {
      eventId: "11111111-1111-4111-8111-111111111111",
      timestamp: 1_719_792_000,
      hostDomain: "app.example.com",
      name: "TransactionSubmitted",
      accountAddress: "0xabc",
      chainId: "0x2105",
      to: "0xdef",
      txHash: "0xhash",
      durationMs: 420,
    };

    const event = deserializeAnalyticsEvent(serializeRpc(raw));

    assert.equal(event.eventId, AnalyticsEventId(raw.eventId));
    assert.equal(event.timestamp, UnixTimestamp(raw.timestamp));
    assert.equal(event.hostDomain, DomainString(raw.hostDomain));
    assert.equal(event.name, "TransactionSubmitted");
    assert.equal(event.accountAddress, "0xabc");
    assert.equal(event.chainId, "0x2105");
    assert.equal(event.to, "0xdef");
    assert.equal(event.txHash, "0xhash");
    assert.equal(event.durationMs, 420);
  });

  it("accepts an already-parsed object", () => {
    const event: IOWSAnalyticsEvent = deserializeAnalyticsEvent({
      eventId: "22222222-2222-4222-8222-222222222222",
      timestamp: 100,
      hostDomain: "localhost",
      name: "AccountCreated",
    });
    assert.equal(event.name, "AccountCreated");
    assert.equal(event.hostDomain, DomainString("localhost"));
  });

  it("rejects missing required fields", () => {
    assert.throws(() =>
      deserializeAnalyticsEvent({
        eventId: "33333333-3333-4333-8333-333333333333",
        timestamp: 1,
        hostDomain: "app.example.com",
      }),
    );
  });
});

import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  DisplayRequestId,
  OWS_DISPLAY_READY_MODEL_METHOD,
  OWS_HIDE_READY_MODEL_METHOD,
  OWS_RELEASE_DISPLAY_EVENT,
  OWS_REQUEST_DISPLAY_EVENT,
  OWS_REQUEST_HIDE_EVENT,
  serializeRpc,
} from "@1shotapi/ows-types";
import { DisplayChildClient } from "../src/display/child-client.ts";

describe("DisplayChildClient", () => {
  const emitted: Array<{ name: string; data: string }> = [];
  const childApi = {
    emit(name: string, data: string) {
      emitted.push({ name, data });
    },
  };

  afterEach(() => {
    emitted.length = 0;
  });

  it("emits requestDisplay and resolves on display ready", async () => {
    const client = new DisplayChildClient(childApi as never);
    const pending = client.requestDisplay();

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.name, OWS_REQUEST_DISPLAY_EVENT);
    const request = JSON.parse(emitted[0]!.data) as {
      displayId: string;
    };

    client.handleDisplayReady(serializeRpc({ displayId: request.displayId }));
    const session = await pending;
    assert.equal(session.displayId, DisplayRequestId(request.displayId));
  });

  it("reuses an active session until release", async () => {
    const client = new DisplayChildClient(childApi as never);
    const first = client.requestDisplay();
    const request = JSON.parse(emitted[0]!.data) as { displayId: string };
    client.handleDisplayReady(serializeRpc({ displayId: request.displayId }));
    const session = await first;

    emitted.length = 0;
    const second = await client.requestDisplay();
    assert.equal(emitted.length, 0);
    assert.equal(second.displayId, session.displayId);

    session.release();
    assert.equal(emitted.length, 0);

    session.release();
    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.name, OWS_RELEASE_DISPLAY_EVENT);
  });

  it("requestHide resolves on hide ready", async () => {
    const client = new DisplayChildClient(childApi as never);
    const pending = client.requestHide();

    assert.equal(emitted.length, 1);
    assert.equal(emitted[0]?.name, OWS_REQUEST_HIDE_EVENT);

    client.handleHideReady(serializeRpc({}));
    await pending;
  });
});

describe("display model method names", () => {
  it("uses reserved Postmate model method names", () => {
    assert.equal(OWS_DISPLAY_READY_MODEL_METHOD, "__owsDisplayReady");
    assert.equal(OWS_HIDE_READY_MODEL_METHOD, "__owsHideReady");
  });
});

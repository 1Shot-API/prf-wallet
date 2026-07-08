import { describe, it, before, after } from "node:test";
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
import { DisplayHostHandler } from "../src/display/host-handler.ts";

class MockHTMLIFrameElement {}

function createMockParent() {
  const listeners = new Map<string, (data: unknown) => void>();
  const calls: Array<{ method: string; data: unknown }> = [];
  const frame = {
    className: "",
    style: {
      length: 0,
      item: () => "",
      getPropertyValue: () => "",
      setProperty: function (this: Record<string, string>, name: string, value: string) {
        this[name] = value;
      },
      removeProperty: function (this: Record<string, string>, name: string) {
        delete this[name];
      },
    } as unknown as CSSStyleDeclaration,
    parentElement: {
      className: "",
      style: {
        length: 0,
        item: () => "",
        getPropertyValue: () => "",
        setProperty: function (this: Record<string, string>, name: string, value: string) {
          this[name] = value;
        },
        removeProperty: function (this: Record<string, string>, name: string) {
          delete this[name];
        },
      } as unknown as CSSStyleDeclaration,
      getAttribute(name: string) {
        return name === "aria-hidden" ? "true" : null;
      },
      setAttribute() {},
      removeAttribute() {},
    },
    focus() {},
    blur() {},
    contentWindow: { focus() {}, blur() {} },
    removeAttribute() {},
  };

  const parent = {
    frame,
    on(event: string, cb: (data: unknown) => void) {
      listeners.set(event, cb);
    },
    call(method: string, data: unknown) {
      calls.push({ method, data });
    },
  };

  return {
    parent: parent as never,
    listeners,
    calls,
    frame,
  };
}

describe("DisplayHostHandler", () => {
  before(() => {
    // @ts-expect-error test shim for instanceof checks in Node
    globalThis.HTMLIFrameElement = MockHTMLIFrameElement;
  });

  after(() => {
    // @ts-expect-error cleanup test shim
    delete globalThis.HTMLIFrameElement;
  });

  it("shows passthrough layout and notifies child when ready", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent);

    const displayId = DisplayRequestId("1");
    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId, width: 1, height: 1 }),
    );

    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0]?.method, OWS_DISPLAY_READY_MODEL_METHOD);
    assert.equal(
      JSON.parse(mock.calls[0]!.data as string).displayId,
      displayId,
    );
    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.width, "1px");
    assert.equal(containerStyle.height, "1px");
    assert.equal(
      (mock.frame.style as unknown as Record<string, string>).width,
      "100%",
    );
    assert.equal(
      (mock.frame.style as unknown as Record<string, string>).position,
      "static",
    );
  });

  it("shows lower-right flyout for visible display using host wallet size", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent);

    const displayId = DisplayRequestId("10");
    // Branding may request other dimensions; host popover size wins.
    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId, width: 448, height: 360 }),
    );

    const frameStyle = mock.frame.style as unknown as Record<string, string>;
    assert.equal(frameStyle.width, "100%");
    assert.equal(frameStyle.height, "100%");
    assert.equal(frameStyle.position, "static");
    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.position, "fixed");
    assert.equal(containerStyle.bottom, "16px");
    assert.equal(containerStyle.right, "16px");
    assert.equal(containerStyle.opacity, "1");
    assert.equal(containerStyle.width, "300px");
    assert.equal(containerStyle.height, "400px");
  });

  it("uses walletSizeX / walletSizeY when provided", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent, {
      walletSizeX: 320,
      walletSizeY: 480,
    });

    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({
        displayId: DisplayRequestId("11"),
        width: 999,
        height: 999,
      }),
    );

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.width, "320px");
    assert.equal(containerStyle.height, "480px");
  });

  it("hides on requestHide and notifies child", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent);

    mock.listeners.get(OWS_REQUEST_HIDE_EVENT)?.(serializeRpc({}));

    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0]?.method, OWS_HIDE_READY_MODEL_METHOD);
  });

  it("initializeHidden collapses a full-screen host container", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    containerStyle.inset = "0";
    containerStyle.width = "100%";
    containerStyle.height = "100%";

    const handler = new DisplayHostHandler(mock.parent);
    handler.initializeHidden();

    assert.equal(containerStyle.width, "0");
    assert.equal(containerStyle.height, "0");
    assert.equal(containerStyle["clip-path"], "inset(50%)");
    assert.equal(containerStyle.opacity, "0");
    assert.equal(containerStyle["pointer-events"], "none");
    handler.destroy();
  });

  it("prepareForRpcAccess overrides clip-path for hidden containers", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent);

    handler.prepareForRpcAccess();

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle["clip-path"], "none");
    assert.equal(containerStyle.overflow, "hidden");
    handler.destroy();
  });

  it("allows a new display session after release", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent);
    const displayId = DisplayRequestId("2");

    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId, width: 448, height: 360 }),
    );

    mock.listeners.get(OWS_RELEASE_DISPLAY_EVENT)?.(
      serializeRpc({ displayId }),
    );

    mock.calls.length = 0;
    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId: DisplayRequestId("3"), width: 1, height: 1 }),
    );

    assert.equal(mock.calls.length, 1);
    handler.destroy();
  });
});

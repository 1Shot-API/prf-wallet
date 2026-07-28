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
import {
  applyHiddenWalletContainerStyles,
  applyHiddenWalletFrameStyles,
  DisplayHostHandler,
  EWalletPresentationMode,
} from "../src/display/host-handler.ts";

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

function ensureWindow(): {
  innerWidth: number;
  innerHeight: number;
  addEventListener: (type: string, listener: () => void) => void;
  removeEventListener: (type: string, listener: () => void) => void;
} {
  if (typeof (globalThis as { window?: unknown }).window === "undefined") {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      writable: true,
      value: {
        innerWidth: 1024,
        innerHeight: 768,
        addEventListener() {},
        removeEventListener() {},
      },
    });
  }
  return (globalThis as unknown as { window: ReturnType<typeof ensureWindow> })
    .window;
}

function stubViewport(width: number, height: number): () => void {
  const win = ensureWindow();
  const previous = {
    innerWidth: Object.getOwnPropertyDescriptor(win, "innerWidth"),
    innerHeight: Object.getOwnPropertyDescriptor(win, "innerHeight"),
  };
  Object.defineProperty(win, "innerWidth", {
    configurable: true,
    get: () => width,
  });
  Object.defineProperty(win, "innerHeight", {
    configurable: true,
    get: () => height,
  });
  return () => {
    if (previous.innerWidth) {
      Object.defineProperty(win, "innerWidth", previous.innerWidth);
    }
    if (previous.innerHeight) {
      Object.defineProperty(win, "innerHeight", previous.innerHeight);
    }
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

  it("shows lower-right flyout when viewport fits wallet size + 32px", () => {
    const restore = stubViewport(800, 700);
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent);

    const displayId = DisplayRequestId("10");
    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId }),
    );

    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0]?.method, OWS_DISPLAY_READY_MODEL_METHOD);
    assert.equal(
      JSON.parse(mock.calls[0]!.data as string).displayId,
      displayId,
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
    assert.equal(containerStyle.width, "360px");
    assert.equal(containerStyle.height, "600px");
    restore();
  });

  it("uses walletSizeX / walletSizeY when provided", () => {
    const restore = stubViewport(800, 700);
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent, {
      walletSizeX: 320,
      walletSizeY: 480,
    });

    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({
        displayId: DisplayRequestId("11"),
      }),
    );

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.width, "320px");
    assert.equal(containerStyle.height, "480px");
    restore();
  });

  it("uses full-screen drawer when viewport is smaller than wallet size + 32px", () => {
    const restore = stubViewport(360, 640);
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent, {
      walletSizeX: 360,
      walletSizeY: 600,
    });

    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId: DisplayRequestId("12") }),
    );

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.position, "fixed");
    assert.equal(containerStyle.inset, "0");
    assert.equal(containerStyle.width, "100%");
    assert.equal(containerStyle.height, "100%");
    assert.equal(containerStyle.bottom, "0");
    assert.equal(containerStyle.right, "0");
    restore();
  });

  it("shouldUseDrawer is true when either axis cannot fit margin", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent, {
      walletSizeX: 360,
      walletSizeY: 600,
    });

    // Needs ≥392×632 (size + 16px each side)
    const restoreNarrow = stubViewport(391, 800);
    assert.equal(handler.shouldUseDrawer(), true);
    restoreNarrow();

    const restoreShort = stubViewport(800, 631);
    assert.equal(handler.shouldUseDrawer(), true);
    restoreShort();

    const restoreFit = stubViewport(392, 632);
    assert.equal(handler.shouldUseDrawer(), false);
    restoreFit();

    handler.destroy();
  });

  it("hides on requestHide and notifies child", async () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    new DisplayHostHandler(mock.parent);

    mock.listeners.get(OWS_REQUEST_HIDE_EVENT)?.(serializeRpc({}));

    await Promise.resolve();
    assert.equal(mock.calls.length, 1);
    assert.equal(mock.calls[0]?.method, OWS_HIDE_READY_MODEL_METHOD);
  });

  it("applyHiddenWalletContainerStyles collapses container before iframe exists", () => {
    const container = {
      className: "wallet-container",
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
      setAttribute() {},
      removeAttribute() {},
      getAttribute() {
        return null;
      },
    };

    applyHiddenWalletContainerStyles(container as never);

    const style = container.style as unknown as Record<string, string>;
    assert.equal(style.width, "0");
    assert.equal(style.height, "0");
    assert.equal(style.opacity, "0");
    assert.equal(style["clip-path"], "inset(50%)");
    assert.equal(style["pointer-events"], "none");
  });

  it("applyHiddenWalletFrameStyles hides iframe at append time", () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);

    applyHiddenWalletFrameStyles(mock.frame as never);

    const frameStyle = mock.frame.style as unknown as Record<string, string>;
    assert.equal(frameStyle.opacity, "0");
    assert.equal(frameStyle["pointer-events"], "none");
    assert.equal(frameStyle.width, "100%");
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

  it("prepareForRpcAccess shows 1×1 passthrough when panel is hidden", () => {
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
    assert.equal(containerStyle.width, "1px");
    assert.equal(containerStyle.height, "1px");
    handler.destroy();
  });

  it("prepareForRpcAccess keeps a visible host panel instead of collapsing to 1×1", () => {
    const restore = stubViewport(800, 700);
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent, {
      walletSizeX: 360,
      walletSizeY: 600,
    });

    handler.show();
    handler.prepareForRpcAccess();

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.width, "360px");
    assert.equal(containerStyle.height, "600px");
    assert.equal(containerStyle.opacity, "1");
    handler.destroy();
    restore();
  });

  it("inline mode fills create container and ignores host hide", async () => {
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent, {
      presentationMode: EWalletPresentationMode.Inline,
    });
    handler.initializeInlineVisible();

    const containerStyle = mock.frame.parentElement.style as unknown as Record<
      string,
      string
    >;
    assert.equal(containerStyle.position, "absolute");
    assert.equal(containerStyle.width, "100%");
    assert.equal(containerStyle.height, "100%");

    handler.hide();
    assert.equal(containerStyle.width, "100%");
    assert.equal(containerStyle.opacity, "1");

    mock.listeners.get(OWS_REQUEST_HIDE_EVENT)?.(serializeRpc({}));
    await Promise.resolve();
    assert.equal(mock.calls[0]?.method, OWS_HIDE_READY_MODEL_METHOD);
    assert.equal(containerStyle.width, "100%");
    assert.equal(containerStyle.opacity, "1");
    handler.destroy();
  });

  it("allows a new display session after release", () => {
    const restore = stubViewport(800, 700);
    const mock = createMockParent();
    Object.setPrototypeOf(mock.frame, MockHTMLIFrameElement.prototype);
    const handler = new DisplayHostHandler(mock.parent);
    const displayId = DisplayRequestId("2");

    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId }),
    );

    mock.listeners.get(OWS_RELEASE_DISPLAY_EVENT)?.(
      serializeRpc({ displayId }),
    );

    mock.calls.length = 0;
    mock.listeners.get(OWS_REQUEST_DISPLAY_EVENT)?.(
      serializeRpc({ displayId: DisplayRequestId("3") }),
    );

    assert.equal(mock.calls.length, 1);
    handler.destroy();
    restore();
  });
});

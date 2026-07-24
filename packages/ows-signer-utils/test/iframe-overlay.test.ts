import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { overlaySignerIframe, showSignerCeremonyPanel } from "../src/iframe.ts";

function createStyleableElement(tag: string): HTMLElement {
  const styleStore = new Map<string, string>();
  const style = {
    length: 0,
    item(index: number): string {
      return [...styleStore.keys()][index] ?? "";
    },
    getPropertyValue(name: string): string {
      return styleStore.get(name) ?? "";
    },
    setProperty(name: string, value: string): void {
      if (!styleStore.has(name)) {
        Object.defineProperty(style, "length", {
          value: styleStore.size + 1,
          writable: true,
          configurable: true,
        });
      }
      styleStore.set(name, value);
      (style as unknown as Record<string, string>)[name] = value;
    },
  };

  const el = {
    style,
    tagName: tag.toUpperCase(),
    parentElement: null as HTMLElement | null,
    contentWindow: { focus() {} },
    focus() {},
    removeAttribute(name: string) {
      if (name === "style") {
        styleStore.clear();
        Object.defineProperty(style, "length", {
          value: 0,
          writable: true,
          configurable: true,
        });
      }
    },
    getBoundingClientRect() {
      return {
        top: 40,
        left: 80,
        width: 320,
        height: 120,
        bottom: 160,
        right: 400,
        x: 80,
        y: 40,
        toJSON() {
          return {};
        },
      };
    },
  };

  return el as unknown as HTMLElement;
}

describe("overlaySignerIframe", () => {
  it("positions home container over the slot and restores styles", () => {
    const home = createStyleableElement("div");
    home.style.setProperty("opacity", "0.5");

    const iframe = createStyleableElement("iframe") as unknown as HTMLIFrameElement;
    (iframe as unknown as { parentElement: HTMLElement }).parentElement = home;

    const slot = createStyleableElement("div");

    const restore = overlaySignerIframe(iframe, slot, { homeContainer: home });

    assert.equal(home.style.getPropertyValue("position"), "fixed");
    assert.equal(home.style.getPropertyValue("top"), "40px");
    assert.equal(home.style.getPropertyValue("left"), "80px");
    assert.equal(home.style.getPropertyValue("width"), "320px");
    assert.equal(home.style.getPropertyValue("height"), "120px");
    assert.equal(iframe.style.getPropertyValue("width"), "100%");
    assert.equal(iframe.style.getPropertyValue("height"), "100%");

    restore();

    assert.equal(home.style.getPropertyValue("opacity"), "0.5");
    assert.equal(home.style.getPropertyValue("position"), "");
    assert.equal(iframe.style.getPropertyValue("width"), "");
  });

  it("throws when homeContainer cannot be resolved", () => {
    const iframe = createStyleableElement("iframe") as unknown as HTMLIFrameElement;
    const slot = createStyleableElement("div");

    assert.throws(
      () => overlaySignerIframe(iframe, slot),
      /homeContainer/,
    );
  });
});

describe("showSignerCeremonyPanel", () => {
  it("shows a visible centered panel and restores styles", () => {
    const home = createStyleableElement("div");
    home.style.setProperty("opacity", "0");

    const iframe = createStyleableElement("iframe") as unknown as HTMLIFrameElement;
    (iframe as unknown as { parentElement: HTMLElement }).parentElement = home;

    const restore = showSignerCeremonyPanel(iframe);

    assert.equal(home.style.getPropertyValue("opacity"), "1");
    assert.equal(home.style.getPropertyValue("position"), "fixed");
    assert.equal(home.style.getPropertyValue("pointer-events"), "auto");
    assert.equal(iframe.style.getPropertyValue("opacity"), "1");
    assert.match(home.style.getPropertyValue("width"), /22rem|92vw/);
    assert.equal(home.style.getPropertyValue("height"), "18rem");
    assert.equal(home.style.getPropertyValue("overflow"), "hidden");
    assert.equal(iframe.style.getPropertyValue("height"), "100%");

    restore();

    assert.equal(home.style.getPropertyValue("opacity"), "0");
    assert.equal(iframe.style.getPropertyValue("opacity"), "");
  });
});

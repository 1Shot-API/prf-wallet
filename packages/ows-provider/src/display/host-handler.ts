import type Postmate from "@1shotapi/postmate";
import {
  OWS_RELEASE_DISPLAY_EVENT,
  OWS_REQUEST_DISPLAY_EVENT,
  OWS_REQUEST_HIDE_EVENT,
  OWS_DISPLAY_READY_MODEL_METHOD,
  OWS_HIDE_READY_MODEL_METHOD,
  deserializeReleaseDisplay,
  deserializeRequestDisplay,
  deserializeRequestHide,
  serializeRpc,
  type DisplayRequestId,
  type RequestDisplayParams,
} from "@1shotapi/ows-types";

const POPOVER_MARGIN_PX = 16;
const POPOVER_SHADOW =
  "0 8px 32px color-mix(in srgb, CanvasText 22%, transparent)";

type StoredLayout = {
  frameClassName: string;
  frameStyle: Record<string, string>;
  containerClassName: string;
  containerStyle: Record<string, string>;
  containerAriaHidden: string | null;
};

function captureInlineStyles(element: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {};
  for (let i = 0; i < element.style.length; i++) {
    const name = element.style.item(i);
    styles[name] = element.style.getPropertyValue(name);
  }
  return styles;
}

function restoreInlineStyles(
  element: HTMLElement,
  className: string,
  styles: Record<string, string>,
): void {
  element.className = className;
  element.removeAttribute("style");
  for (const [name, value] of Object.entries(styles)) {
    element.style.setProperty(name, value);
  }
}

function isPassthroughDisplay(width: number, height: number): boolean {
  return width <= 1 && height <= 1;
}

export class DisplayHostHandler {
  private originalLayout: StoredLayout | null = null;
  private childDisplayId: DisplayRequestId | null = null;
  private rpcAccessCount = 0;

  constructor(private readonly parent: Postmate.ParentAPI) {
    parent.on(OWS_REQUEST_DISPLAY_EVENT, (data: unknown) => {
      this.handleRequestDisplay(data);
    });
    parent.on(OWS_RELEASE_DISPLAY_EVENT, (data: unknown) => {
      this.handleReleaseDisplay(data);
    });
    parent.on(OWS_REQUEST_HIDE_EVENT, (data: unknown) => {
      this.handleRequestHide(data);
    });
  }

  destroy(): void {
    this.hideLayout();
  }

  /**
   * Synchronously show/focus the wallet iframe before Postmate RPC is sent.
   * Preserves host user activation for WebAuthn in cross-origin embeds (1ShotPay pattern).
   */
  prepareForRpcAccess(): void {
    this.rpcAccessCount++;
    this.showLayout(1, 1);
    this.focusFrame();
  }

  /** Hide the wallet iframe after RPC completes unless branding still holds a display session. */
  completeRpcAccess(): void {
    this.rpcAccessCount = Math.max(0, this.rpcAccessCount - 1);
    if (this.rpcAccessCount === 0 && !this.childDisplayId) {
      const hide = (): void => {
        if (this.rpcAccessCount === 0 && !this.childDisplayId) {
          this.hideLayout();
        }
      };
      if (typeof globalThis.setTimeout === "function") {
        globalThis.setTimeout(hide, 250);
      } else {
        hide();
      }
    }
  }

  private handleRequestDisplay(data: unknown): void {
    let envelope;
    try {
      envelope = deserializeRequestDisplay(data);
    } catch {
      return;
    }

    this.childDisplayId = envelope.displayId;
    this.showLayout(envelope.width, envelope.height);
    this.focusFrame();
    this.notifyDisplayReady(envelope.displayId);
  }

  private handleReleaseDisplay(data: unknown): void {
    let envelope;
    try {
      envelope = deserializeReleaseDisplay(data);
    } catch {
      return;
    }

    if (this.childDisplayId !== envelope.displayId) {
      return;
    }

    this.childDisplayId = null;
    if (this.rpcAccessCount === 0) {
      this.hideLayout();
    }
  }

  private handleRequestHide(data: unknown): void {
    let envelope;
    try {
      envelope = deserializeRequestHide(data);
    } catch {
      return;
    }

    if (
      envelope.displayId &&
      this.childDisplayId &&
      this.childDisplayId !== envelope.displayId
    ) {
      return;
    }

    this.childDisplayId = null;
    this.hideLayout();
    this.notifyHideReady(envelope.displayId);
  }

  private notifyDisplayReady(displayId: DisplayRequestId): void {
    this.parent.call(
      OWS_DISPLAY_READY_MODEL_METHOD,
      serializeRpc({ displayId } satisfies { displayId: DisplayRequestId }),
    );
  }

  private notifyHideReady(displayId?: DisplayRequestId): void {
    this.parent.call(
      OWS_HIDE_READY_MODEL_METHOD,
      serializeRpc(displayId ? { displayId } : {}),
    );
  }

  private captureOriginalLayout(frame: HTMLIFrameElement): void {
    if (this.originalLayout) {
      return;
    }

    const container = frame.parentElement;
    this.originalLayout = {
      frameClassName: frame.className,
      frameStyle: captureInlineStyles(frame),
      containerClassName: container?.className ?? "",
      containerStyle: container ? captureInlineStyles(container) : {},
      containerAriaHidden: container?.getAttribute("aria-hidden") ?? null,
    };
  }

  private showLayout(width: number, height: number): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }

    this.captureOriginalLayout(frame);
    this.applyDisplayLayout(frame, width, height);
  }

  private applyDisplayLayout(frame: HTMLIFrameElement, width: number, height: number): void {
    const container = frame.parentElement;
    const passthrough = isPassthroughDisplay(width, height);

    if (container) {
      container.style.setProperty("display", "block", "important");
      container.style.setProperty("position", "fixed", "important");
      container.style.setProperty("clip-path", "none", "important");
      container.style.setProperty("overflow", "visible", "important");
      container.style.setProperty("background", "transparent", "important");
      container.removeAttribute("aria-hidden");
    }

    frame.style.setProperty("display", "block", "important");
    frame.style.setProperty("position", "fixed", "important");
    frame.style.setProperty("border", "none", "important");
    frame.style.setProperty("margin", "0", "important");
    frame.style.setProperty("padding", "0", "important");
    frame.removeAttribute("aria-hidden");

    if (passthrough) {
      if (container) {
        container.style.setProperty("inset", "0", "important");
        container.style.setProperty("width", "100vw", "important");
        container.style.setProperty("height", "100vh", "important");
        container.style.setProperty("pointer-events", "none", "important");
        container.style.setProperty("z-index", "9998", "important");
        container.style.setProperty("opacity", "0", "important");
      }

      frame.style.setProperty("top", "0", "important");
      frame.style.setProperty("left", "0", "important");
      frame.style.setProperty("width", "1px", "important");
      frame.style.setProperty("height", "1px", "important");
      frame.style.setProperty("opacity", "0", "important");
      frame.style.setProperty("pointer-events", "auto", "important");
      frame.style.setProperty("z-index", "9999", "important");
      frame.style.setProperty("transform", "none", "important");
      frame.style.removeProperty("border-radius");
      frame.style.removeProperty("box-shadow");
      frame.style.removeProperty("background");
      return;
    }

    // Lower-right flyout — no modal backdrop; opaque wallet panel only.
    if (container) {
      container.style.setProperty("inset", "auto", "important");
      container.style.setProperty(
        "bottom",
        `${POPOVER_MARGIN_PX}px`,
        "important",
      );
      container.style.setProperty(
        "right",
        `${POPOVER_MARGIN_PX}px`,
        "important",
      );
      container.style.setProperty("width", `${width}px`, "important");
      container.style.setProperty("height", `${height}px`, "important");
      container.style.setProperty("pointer-events", "auto", "important");
      container.style.setProperty("z-index", "9999", "important");
      container.style.setProperty("opacity", "1", "important");
    }

    frame.style.setProperty("top", "0", "important");
    frame.style.setProperty("left", "0", "important");
    frame.style.setProperty("right", "0", "important");
    frame.style.setProperty("bottom", "0", "important");
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("height", "100%", "important");
    frame.style.setProperty("transform", "none", "important");
    frame.style.setProperty("opacity", "1", "important");
    frame.style.setProperty("pointer-events", "auto", "important");
    frame.style.setProperty("z-index", "9999", "important");
    frame.style.setProperty("border-radius", "12px", "important");
    frame.style.setProperty("box-shadow", POPOVER_SHADOW, "important");
    frame.style.setProperty("background", "Canvas", "important");
    frame.style.setProperty("color-scheme", "light dark", "important");
  }

  private focusFrame(): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }

    try {
      frame.contentWindow?.focus();
      frame.focus();
    } catch (error) {
      console.warn("[ows-provider] Could not focus wallet iframe:", error);
    }
  }

  private hideLayout(): void {
    if (!this.originalLayout) {
      return;
    }

    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      this.originalLayout = null;
      return;
    }

    const container = frame.parentElement;
    const stored = this.originalLayout;

    try {
      frame.contentWindow?.blur();
      frame.blur();
      if (document.activeElement === frame) {
        (document.body as HTMLElement).focus();
      }
    } catch {
      // ignore blur failures
    }

    restoreInlineStyles(frame, stored.frameClassName, stored.frameStyle);
    if (container) {
      restoreInlineStyles(
        container,
        stored.containerClassName,
        stored.containerStyle,
      );
      if (stored.containerAriaHidden !== null) {
        container.setAttribute("aria-hidden", stored.containerAriaHidden);
      } else {
        container.removeAttribute("aria-hidden");
      }
    }

    this.originalLayout = null;
  }
}

export type { RequestDisplayParams };

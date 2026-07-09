import type Postmate from "postmate";
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

/** Default visible wallet flyout size (host-controlled). */
export const DEFAULT_WALLET_SIZE_X = 300;
export const DEFAULT_WALLET_SIZE_Y = 400;

export type DisplayHostHandlerOptions = {
  /** Visible flyout width in CSS pixels. Default: {@link DEFAULT_WALLET_SIZE_X}. */
  walletSizeX?: number;
  /** Visible flyout height in CSS pixels. Default: {@link DEFAULT_WALLET_SIZE_Y}. */
  walletSizeY?: number;
};

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
  /** Host-initiated visible flyout (e.g. demo "Show Wallet" button). */
  private hostDisplayActive = false;
  private readonly walletSizeX: number;
  private readonly walletSizeY: number;

  constructor(
    private readonly parent: Postmate.ParentAPI,
    options?: DisplayHostHandlerOptions,
  ) {
    this.walletSizeX = options?.walletSizeX ?? DEFAULT_WALLET_SIZE_X;
    this.walletSizeY = options?.walletSizeY ?? DEFAULT_WALLET_SIZE_Y;

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
    this.hostDisplayActive = false;
    this.hideLayout();
  }

  /**
   * Collapse the host container and iframe until {@link show} or a branding display
   * request. Call once after Postmate creates the iframe so hosts need no wallet CSS.
   */
  initializeHidden(): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }

    this.applyHiddenLayout(frame);
    this.captureOriginalLayout(frame);
  }

  /**
   * Host-initiated lower-right flyout (visible branding panel).
   * Kept open until {@link hide} or the branding layer requests hide.
   * Uses the configured {@link DisplayHostHandlerOptions.walletSizeX} /
   * {@link DisplayHostHandlerOptions.walletSizeY}.
   */
  show(): void {
    this.hostDisplayActive = true;
    this.showVisibleFlyout();
    this.focusFrame();
  }

  /** Hide a host-initiated flyout unless branding still holds a display session. */
  hide(): void {
    this.hostDisplayActive = false;
    if (this.rpcAccessCount === 0 && !this.childDisplayId) {
      this.hideLayout();
    }
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
    if (this.rpcAccessCount !== 0) {
      return;
    }

    const restoreOrHide = (): void => {
      if (this.rpcAccessCount !== 0) {
        return;
      }
      if (this.childDisplayId || this.hostDisplayActive) {
        // Restore host-sized flyout after passthrough (1×1) WebAuthn layout.
        this.showVisibleFlyout();
        return;
      }
      this.hideLayout();
    };

    if (typeof globalThis.setTimeout === "function") {
      globalThis.setTimeout(restoreOrHide, 250);
    } else {
      restoreOrHide();
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
    // Passthrough (≤1×1) stays 1×1 for WebAuthn; visible requests use host popover size.
    if (isPassthroughDisplay(envelope.width, envelope.height)) {
      this.showLayout(1, 1);
    } else {
      this.showVisibleFlyout();
    }
    this.focusFrame();
    this.notifyDisplayReady(envelope.displayId);
  }

  private showVisibleFlyout(): void {
    this.showLayout(this.walletSizeX, this.walletSizeY);
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
    if (this.rpcAccessCount === 0 && !this.hostDisplayActive) {
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
    this.hostDisplayActive = false;
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

    // Container owns placement; iframe only fills the container (no position:fixed —
    // fixed + width/height 100% resolves against the viewport and goes full-screen).
    if (container) {
      container.style.setProperty("display", "block", "important");
      container.style.setProperty("position", "fixed", "important");
      container.style.setProperty("clip-path", "none", "important");
      container.style.setProperty("overflow", "hidden", "important");
      container.removeAttribute("aria-hidden");
    }

    frame.style.setProperty("display", "block", "important");
    frame.style.setProperty("position", "static", "important");
    frame.style.setProperty("width", "100%", "important");
    frame.style.setProperty("height", "100%", "important");
    frame.style.setProperty("border", "none", "important");
    frame.style.setProperty("margin", "0", "important");
    frame.style.setProperty("padding", "0", "important");
    frame.style.setProperty("transform", "none", "important");
    frame.style.removeProperty("top");
    frame.style.removeProperty("left");
    frame.style.removeProperty("right");
    frame.style.removeProperty("bottom");
    frame.style.removeProperty("z-index");
    frame.removeAttribute("aria-hidden");

    if (passthrough) {
      if (container) {
        container.style.setProperty("inset", "auto", "important");
        container.style.setProperty("top", "0", "important");
        container.style.setProperty("left", "0", "important");
        container.style.setProperty("bottom", "auto", "important");
        container.style.setProperty("right", "auto", "important");
        container.style.setProperty("width", "1px", "important");
        container.style.setProperty("height", "1px", "important");
        container.style.setProperty("pointer-events", "auto", "important");
        container.style.setProperty("z-index", "9999", "important");
        container.style.setProperty("opacity", "0", "important");
        container.style.setProperty("background", "transparent", "important");
        container.style.removeProperty("border-radius");
        container.style.removeProperty("box-shadow");
      }

      frame.style.setProperty("opacity", "0", "important");
      frame.style.setProperty("pointer-events", "auto", "important");
      frame.style.removeProperty("border-radius");
      frame.style.removeProperty("box-shadow");
      frame.style.removeProperty("background");
      frame.style.removeProperty("color-scheme");
      return;
    }

    // Lower-right flyout — no modal backdrop; opaque wallet panel only.
    if (container) {
      container.style.setProperty("inset", "auto", "important");
      container.style.setProperty("top", "auto", "important");
      container.style.setProperty("left", "auto", "important");
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
      container.style.setProperty("background", "Canvas", "important");
      container.style.setProperty("border-radius", "12px", "important");
      container.style.setProperty("box-shadow", POPOVER_SHADOW, "important");
    }

    frame.style.setProperty("opacity", "1", "important");
    frame.style.setProperty("pointer-events", "auto", "important");
    frame.style.setProperty("background", "Canvas", "important");
    frame.style.setProperty("color-scheme", "light dark", "important");
    frame.style.removeProperty("border-radius");
    frame.style.removeProperty("box-shadow");
  }

  /** Default hidden embed: zero-size clipped container; iframe loaded but not visible. */
  private applyHiddenLayout(frame: HTMLIFrameElement): void {
    const container = frame.parentElement;
    if (container) {
      applyHiddenWalletContainerStyles(container);
    }
    applyHiddenWalletFrameStyles(frame);
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
      const frame = this.parent.frame;
      if (frame instanceof HTMLIFrameElement) {
        this.applyHiddenLayout(frame);
      }
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

/**
 * Collapse the host wallet container before the iframe exists.
 * Call before Postmate appends the iframe so hosts need no wallet CSS.
 */
export function applyHiddenWalletContainerStyles(container: HTMLElement): void {
  container.style.setProperty("display", "block", "important");
  container.style.setProperty("position", "fixed", "important");
  container.style.setProperty("inset", "auto", "important");
  container.style.setProperty("top", "0", "important");
  container.style.setProperty("left", "0", "important");
  container.style.setProperty("bottom", "auto", "important");
  container.style.setProperty("right", "auto", "important");
  container.style.setProperty("width", "0", "important");
  container.style.setProperty("height", "0", "important");
  container.style.setProperty("overflow", "hidden", "important");
  container.style.setProperty("clip-path", "inset(50%)", "important");
  container.style.setProperty("pointer-events", "none", "important");
  container.style.setProperty("opacity", "0", "important");
  container.style.setProperty("z-index", "-1", "important");
  container.style.removeProperty("border-radius");
  container.style.removeProperty("box-shadow");
  container.style.removeProperty("background");
  container.setAttribute("aria-hidden", "true");
}

/**
 * Hide the branding iframe as soon as Postmate appends it (before handshake).
 */
export function applyHiddenWalletFrameStyles(frame: HTMLIFrameElement): void {
  frame.style.setProperty("display", "block", "important");
  frame.style.setProperty("position", "static", "important");
  frame.style.setProperty("width", "100%", "important");
  frame.style.setProperty("height", "100%", "important");
  frame.style.setProperty("border", "none", "important");
  frame.style.setProperty("margin", "0", "important");
  frame.style.setProperty("padding", "0", "important");
  frame.style.setProperty("transform", "none", "important");
  frame.style.setProperty("pointer-events", "none", "important");
  frame.style.setProperty("opacity", "0", "important");
  frame.style.removeProperty("top");
  frame.style.removeProperty("left");
  frame.style.removeProperty("right");
  frame.style.removeProperty("bottom");
  frame.style.removeProperty("z-index");
  frame.style.removeProperty("border-radius");
  frame.style.removeProperty("box-shadow");
  frame.style.removeProperty("background");
  frame.style.removeProperty("color-scheme");
  frame.removeAttribute("aria-hidden");
}

export type { RequestDisplayParams };

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

/**
 * How the host presents the Branding Layer iframe.
 * Fixed at {@link OWSProxy.create} — do not move/reparent the iframe later
 * (Postmate messaging breaks if the frame is detached/reparented).
 *
 * To change presentation, destroy the proxy and create a new one against the
 * desired container with a new mode.
 */
export enum EWalletPresentationMode {
  /**
   * Host-controlled flyout: collapsed when hidden, fixed lower-right when shown.
   * Responds to show/hide and branding display requests.
   */
  Flyout = "flyout",
  /**
   * Always-visible fill of the create() container (sidebar, design slot, etc.).
   * Show/hide and branding hide do not collapse the panel.
   */
  Inline = "inline",
}

/** Default visible wallet size (host-controlled; MetaMask-like). */
export const DEFAULT_WALLET_SIZE_X = 360;
export const DEFAULT_WALLET_SIZE_Y = 600;

export type DisplayHostHandlerOptions = {
  /** Visible panel width in CSS pixels. Default: {@link DEFAULT_WALLET_SIZE_X}. */
  walletSizeX?: number;
  /** Visible panel height in CSS pixels. Default: {@link DEFAULT_WALLET_SIZE_Y}. */
  walletSizeY?: number;
  /**
   * Presentation mode for this proxy instance. Default: flyout.
   * Immutable after construct — recreate the proxy to switch modes.
   */
  presentationMode?: EWalletPresentationMode;
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
  /** Host-initiated visible panel (flyout mode). */
  private hostDisplayActive = false;
  /** True while the last applied layout was 1×1 WebAuthn passthrough. */
  private usePassthroughLayout = false;
  private readonly walletSizeX: number;
  private readonly walletSizeY: number;
  private readonly presentationMode: EWalletPresentationMode;

  constructor(
    private readonly parent: Postmate.ParentAPI,
    options?: DisplayHostHandlerOptions,
  ) {
    this.walletSizeX = options?.walletSizeX ?? DEFAULT_WALLET_SIZE_X;
    this.walletSizeY = options?.walletSizeY ?? DEFAULT_WALLET_SIZE_Y;
    this.presentationMode =
      options?.presentationMode ?? EWalletPresentationMode.Flyout;

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

  get isInline(): boolean {
    return this.presentationMode === EWalletPresentationMode.Inline;
  }

  destroy(): void {
    this.hostDisplayActive = false;
    if (!this.isInline) {
      this.hideLayout();
    }
  }

  /**
   * Collapse the host container until {@link show} (flyout only).
   * Inline mode skips this — the create() container stays filled/visible.
   */
  initializeHidden(): void {
    if (this.isInline) {
      return;
    }
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }

    this.applyHiddenLayout(frame);
    this.captureOriginalLayout(frame);
  }

  /**
   * Inline mode: fill the create() container and keep the panel visible.
   * Call after Postmate handshake when {@link EWalletPresentationMode.Inline}.
   */
  initializeInlineVisible(): void {
    if (!this.isInline) {
      return;
    }
    this.hostDisplayActive = true;
    this.showVisiblePanel();
  }

  /**
   * Host-initiated show. Flyout: lower-right panel. Inline: ensure filled/visible.
   */
  show(): void {
    this.hostDisplayActive = true;
    this.showVisiblePanel();
    this.focusFrame();
  }

  /**
   * Host-initiated hide. Flyout: collapse unless branding holds a session.
   * Inline: no-op (panel stays in the page slot).
   */
  hide(): void {
    if (this.isInline) {
      return;
    }
    this.hostDisplayActive = false;
    if (this.rpcAccessCount === 0 && !this.childDisplayId) {
      this.hideLayout();
    }
  }

  /**
   * Synchronously show/focus the wallet iframe before Postmate RPC is sent.
   * Preserves host user activation for WebAuthn in cross-origin embeds.
   *
   * Never reparents the iframe (that breaks Postmate). When a full-size panel
   * is already visible, keep it instead of collapsing to 1×1.
   */
  prepareForRpcAccess(): void {
    this.rpcAccessCount++;
    if (this.isInline || this.hostDisplayActive) {
      this.focusFrame();
      return;
    }
    if (this.childDisplayId !== null && !this.usePassthroughLayout) {
      this.focusFrame();
      return;
    }
    this.showLayout(1, 1);
    this.focusFrame();
  }

  /** Restore/hide after RPC unless branding still holds a display session. */
  completeRpcAccess(): void {
    this.rpcAccessCount = Math.max(0, this.rpcAccessCount - 1);
    if (this.rpcAccessCount !== 0) {
      return;
    }

    const restoreOrHide = (): void => {
      if (this.rpcAccessCount !== 0) {
        return;
      }
      if (this.isInline) {
        this.showVisiblePanel();
        return;
      }
      if (this.childDisplayId || this.hostDisplayActive) {
        this.showVisiblePanel();
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

    if (this.isInline) {
      // Stay filled; still ack so branding display handshake completes.
      if (isPassthroughDisplay(envelope.width, envelope.height)) {
        // Prefer keeping the visible panel — WebAuthn works in a full-size frame.
        this.showVisiblePanel();
      } else {
        this.showVisiblePanel();
      }
      this.focusFrame();
      this.notifyDisplayReady(envelope.displayId);
      return;
    }

    if (isPassthroughDisplay(envelope.width, envelope.height)) {
      this.showLayout(1, 1);
    } else {
      this.showVisiblePanel();
    }
    this.focusFrame();
    this.notifyDisplayReady(envelope.displayId);
  }

  private showVisiblePanel(): void {
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
    if (this.isInline) {
      this.showVisiblePanel();
      return;
    }
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

    if (this.isInline) {
      // Ack hide to branding, but keep the page-embedded panel visible.
      this.notifyHideReady(envelope.displayId);
      this.showVisiblePanel();
      return;
    }

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

  private applyDisplayLayout(
    frame: HTMLIFrameElement,
    width: number,
    height: number,
  ): void {
    const container = frame.parentElement;
    const passthrough = isPassthroughDisplay(width, height);
    this.usePassthroughLayout = passthrough;

    // Container owns placement; iframe only fills the container (no position:fixed
    // on the iframe — fixed + width/height 100% resolves against the viewport).
    if (container) {
      container.style.setProperty("display", "block", "important");
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
        container.style.setProperty("position", "fixed", "important");
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

    if (this.isInline) {
      this.applyInlineVisibleLayout(container, width, height);
    } else {
      this.applyFlyoutVisibleLayout(container, width, height);
    }

    frame.style.setProperty("opacity", "1", "important");
    frame.style.setProperty("pointer-events", "auto", "important");
    frame.style.setProperty("background", "Canvas", "important");
    frame.style.setProperty("color-scheme", "light dark", "important");
    frame.style.removeProperty("border-radius");
    frame.style.removeProperty("box-shadow");
  }

  private applyFlyoutVisibleLayout(
    container: HTMLElement | null,
    width: number,
    height: number,
  ): void {
    if (!container) return;

    container.style.setProperty("position", "fixed", "important");
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

  private applyInlineVisibleLayout(
    container: HTMLElement | null,
    width: number,
    height: number,
  ): void {
    if (!container) return;

    // Fill the create() container in-place (no reparent). Host sizes the mount.
    container.style.setProperty("position", "absolute", "important");
    container.style.setProperty("inset", "0", "important");
    container.style.setProperty("top", "0", "important");
    container.style.setProperty("left", "0", "important");
    container.style.setProperty("right", "0", "important");
    container.style.setProperty("bottom", "0", "important");
    container.style.setProperty("width", "100%", "important");
    container.style.setProperty("height", "100%", "important");
    container.style.setProperty("margin", "0", "important");
    container.style.setProperty("pointer-events", "auto", "important");
    container.style.setProperty("z-index", "1", "important");
    container.style.setProperty("opacity", "1", "important");
    container.style.setProperty("background", "Canvas", "important");
    container.style.setProperty("border-radius", "12px", "important");
    container.style.removeProperty("box-shadow");
    container.style.setProperty("--ows-wallet-size-x", `${width}px`);
    container.style.setProperty("--ows-wallet-size-y", `${height}px`);
  }

  private applyHiddenLayout(frame: HTMLIFrameElement): void {
    const container = frame.parentElement;
    if (container) {
      applyHiddenWalletContainerStyles(container);
    }
    applyHiddenWalletFrameStyles(frame);
    this.usePassthroughLayout = false;
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
    this.usePassthroughLayout = false;

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

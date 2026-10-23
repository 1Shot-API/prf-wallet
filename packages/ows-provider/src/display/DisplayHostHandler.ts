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
/** Wipe duration for drawer open/close (ms). */
const DRAWER_ANIMATION_MS = 280;
const DRAWER_EASING = "cubic-bezier(0.32, 0.72, 0, 1)";

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
   * Host-controlled panel: flyout (lower-right) when the viewport is wide
   * enough for `walletSizeX + 32px`; full-screen drawer with bottom wipe when
   * not. Responds to show/hide and branding display requests.
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
};

type EVisibleLayoutKind = "flyout" | "drawer";

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

export class DisplayHostHandler {
  private originalLayout: StoredLayout | null = null;
  private childDisplayId: DisplayRequestId | null = null;
  private rpcAccessCount = 0;
  /** Host-initiated visible panel (flyout mode). */
  private hostDisplayActive = false;
  /** True while the last applied layout was 1×1 WebAuthn passthrough. */
  private usePassthroughLayout = false;
  /** Last non-passthrough visible layout (for close animation). */
  private visibleLayoutKind: EVisibleLayoutKind | null = null;
  private hideAnimation: Animation | null = null;
  private readonly walletSizeX: number;
  private readonly walletSizeY: number;
  private readonly presentationMode: EWalletPresentationMode;
  private readonly onViewportChange: () => void;

  constructor(
    private readonly parent: Postmate.ParentAPI,
    options?: DisplayHostHandlerOptions,
  ) {
    this.walletSizeX = options?.walletSizeX ?? DEFAULT_WALLET_SIZE_X;
    this.walletSizeY = options?.walletSizeY ?? DEFAULT_WALLET_SIZE_Y;
    this.presentationMode =
      options?.presentationMode ?? EWalletPresentationMode.Flyout;

    this.onViewportChange = () => {
      if (this.isInline || this.usePassthroughLayout) {
        return;
      }
      if (!this.hostDisplayActive && this.childDisplayId === null) {
        return;
      }
      this.showVisiblePanel({ animate: false });
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", this.onViewportChange);
    }

    parent.on(OWS_REQUEST_DISPLAY_EVENT, (data: unknown) => {
      this.handleRequestDisplay(data);
    });
    parent.on(OWS_RELEASE_DISPLAY_EVENT, (data: unknown) => {
      this.handleReleaseDisplay(data);
    });
    parent.on(OWS_REQUEST_HIDE_EVENT, (data: unknown) => {
      void this.handleRequestHide(data);
    });
  }

  get isInline(): boolean {
    return this.presentationMode === EWalletPresentationMode.Inline;
  }

  /**
   * True when the host viewport is too narrow for the configured wallet width
   * plus a 16px margin on each side — use a full-screen drawer instead of a flyout.
   *
   * Width-only: a short-but-wide desktop window (common on 1080p @ 150% DPI with
   * browser chrome) should keep the corner flyout, not jump to mobile drawer UX.
   */
  shouldUseDrawer(): boolean {
    if (typeof window === "undefined") {
      return false;
    }
    const margin = POPOVER_MARGIN_PX * 2;
    const width = window.visualViewport?.width ?? window.innerWidth;
    return width < this.walletSizeX + margin;
  }

  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("resize", this.onViewportChange);
    }
    this.hideAnimation?.cancel();
    this.hideAnimation = null;
    this.hostDisplayActive = false;
    if (!this.isInline) {
      this.hideLayoutSync();
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
    this.showVisiblePanel({ animate: false });
  }

  /**
   * Host-initiated show. Flyout or drawer depending on viewport; inline fills.
   */
  show(): void {
    this.hostDisplayActive = true;
    this.showVisiblePanel({ animate: true });
    this.focusFrame();
  }

  /**
   * Host-initiated hide. Flyout/drawer: collapse unless branding holds a session.
   * Inline: no-op (panel stays in the page slot).
   */
  hide(): void {
    if (this.isInline) {
      return;
    }
    this.hostDisplayActive = false;
    if (this.rpcAccessCount === 0 && !this.childDisplayId) {
      void this.hideLayoutAnimated();
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
    this.showPassthroughLayout();
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
        this.showVisiblePanel({ animate: false });
        return;
      }
      if (this.childDisplayId || this.hostDisplayActive) {
        this.showVisiblePanel({ animate: false });
        return;
      }
      void this.hideLayoutAnimated();
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
      this.showVisiblePanel({ animate: false });
      this.focusFrame();
      this.notifyDisplayReady(envelope.displayId);
      return;
    }

    this.showVisiblePanel({ animate: true });
    this.focusFrame();
    this.notifyDisplayReady(envelope.displayId);
  }

  private showVisiblePanel(options?: { animate?: boolean }): void {
    const animate = options?.animate !== false;
    if (this.isInline) {
      this.showInlineLayout();
      return;
    }
    if (this.shouldUseDrawer()) {
      this.showDrawerLayout({ animate });
    } else {
      this.showFlyoutLayout();
    }
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
      this.showVisiblePanel({ animate: false });
      return;
    }
    if (this.rpcAccessCount === 0 && !this.hostDisplayActive) {
      void this.hideLayoutAnimated();
    }
  }

  private async handleRequestHide(data: unknown): Promise<void> {
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
      // Stale hide from a superseded display session — still ack so branding
      // does not hang forever waiting for hideReady (blocks Connect UX).
      this.notifyHideReady(envelope.displayId);
      return;
    }

    this.childDisplayId = null;

    if (this.isInline) {
      this.notifyHideReady(envelope.displayId);
      this.showVisiblePanel({ animate: false });
      return;
    }

    this.hostDisplayActive = false;
    await this.hideLayoutAnimated();
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
    };
  }

  private prepareFrameFill(frame: HTMLIFrameElement): HTMLElement | null {
    const container = frame.parentElement;
    this.captureOriginalLayout(frame);
    this.usePassthroughLayout = false;
    this.hideAnimation?.cancel();
    this.hideAnimation = null;

    if (container) {
      container.style.setProperty("display", "block", "important");
      container.style.setProperty("clip-path", "none", "important");
      container.style.setProperty("overflow", "hidden", "important");
      revealWalletContainer(container);
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
    frame.style.setProperty("opacity", "1", "important");
    frame.style.setProperty("pointer-events", "auto", "important");
    frame.style.setProperty("background", "Canvas", "important");
    frame.style.setProperty("color-scheme", "light dark", "important");
    frame.style.removeProperty("border-radius");
    frame.style.removeProperty("box-shadow");

    return container;
  }

  private showPassthroughLayout(): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }
    const container = this.prepareFrameFill(frame);
    this.usePassthroughLayout = true;
    this.visibleLayoutKind = null;

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
      container.style.setProperty("transform", "none", "important");
      container.style.removeProperty("border-radius");
      container.style.removeProperty("box-shadow");
      container.style.removeProperty("transition");
    }

    frame.style.setProperty("opacity", "0", "important");
    frame.style.setProperty("pointer-events", "auto", "important");
  }

  private showFlyoutLayout(): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }
    const container = this.prepareFrameFill(frame);
    if (!container) return;

    this.visibleLayoutKind = "flyout";
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
    container.style.setProperty("width", `${this.walletSizeX}px`, "important");
    container.style.setProperty("height", `${this.walletSizeY}px`, "important");
    container.style.setProperty("pointer-events", "auto", "important");
    container.style.setProperty("z-index", "9999", "important");
    container.style.setProperty("opacity", "1", "important");
    container.style.setProperty("background", "Canvas", "important");
    container.style.setProperty("border-radius", "12px", "important");
    container.style.setProperty("box-shadow", POPOVER_SHADOW, "important");
    container.style.setProperty("transform", "none", "important");
    container.style.removeProperty("transition");
  }

  private showDrawerLayout(options?: { animate?: boolean }): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }
    const container = this.prepareFrameFill(frame);
    if (!container) return;

    const animate = options?.animate !== false;
    this.visibleLayoutKind = "drawer";

    container.style.setProperty("position", "fixed", "important");
    container.style.setProperty("inset", "0", "important");
    container.style.setProperty("top", "0", "important");
    container.style.setProperty("left", "0", "important");
    container.style.setProperty("right", "0", "important");
    container.style.setProperty("bottom", "0", "important");
    container.style.setProperty("width", "100%", "important");
    container.style.setProperty("height", "100%", "important");
    container.style.setProperty("margin", "0", "important");
    container.style.setProperty("pointer-events", "auto", "important");
    container.style.setProperty("z-index", "9999", "important");
    container.style.setProperty("opacity", "1", "important");
    container.style.setProperty("background", "Canvas", "important");
    container.style.setProperty("border-radius", "0", "important");
    container.style.removeProperty("box-shadow");
    container.style.removeProperty("transition");

    if (animate && typeof container.animate === "function") {
      container.style.removeProperty("transform");
      const animation = container.animate(
        [
          { transform: "translateY(100%)" },
          { transform: "translateY(0)" },
        ],
        {
          duration: DRAWER_ANIMATION_MS,
          easing: DRAWER_EASING,
          fill: "forwards",
        },
      );
      void animation.finished
        .then(() => {
          container.style.setProperty("transform", "none", "important");
          animation.cancel();
        })
        .catch(() => {
          container.style.setProperty("transform", "none", "important");
        });
    } else {
      container.style.setProperty("transform", "none", "important");
    }
  }

  private showInlineLayout(): void {
    const frame = this.parent.frame;
    if (!(frame instanceof HTMLIFrameElement)) {
      return;
    }
    const container = this.prepareFrameFill(frame);
    if (!container) return;

    this.visibleLayoutKind = null;
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
    container.style.setProperty("transform", "none", "important");
    container.style.removeProperty("box-shadow");
    container.style.removeProperty("transition");
    container.style.setProperty(
      "--ows-wallet-size-x",
      `${this.walletSizeX}px`,
    );
    container.style.setProperty(
      "--ows-wallet-size-y",
      `${this.walletSizeY}px`,
    );
  }

  private applyHiddenLayout(frame: HTMLIFrameElement): void {
    releaseWalletFrameFocus(frame);
    const container = frame.parentElement;
    if (container) {
      applyHiddenWalletContainerStyles(container);
    }
    applyHiddenWalletFrameStyles(frame);
    this.usePassthroughLayout = false;
    this.visibleLayoutKind = null;
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

  private async hideLayoutAnimated(): Promise<void> {
    const wasDrawer = this.visibleLayoutKind === "drawer";
    const frame = this.parent.frame;
    const container =
      frame instanceof HTMLIFrameElement ? frame.parentElement : null;

    // Release focus before any hide styling / aria-hidden so Chrome does not
    // warn about a focused iframe under an aria-hidden ancestor (common after
    // WebAuthn leaves focus inside the branding/signing frame).
    if (frame instanceof HTMLIFrameElement) {
      releaseWalletFrameFocus(frame);
    }

    if (
      wasDrawer &&
      container &&
      typeof container.animate === "function" &&
      !this.usePassthroughLayout
    ) {
      this.hideAnimation?.cancel();
      container.style.removeProperty("transform");
      try {
        const animation = container.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(100%)" },
          ],
          {
            duration: DRAWER_ANIMATION_MS,
            easing: DRAWER_EASING,
            fill: "forwards",
          },
        );
        this.hideAnimation = animation;
        await animation.finished;
      } catch {
        // Interrupted / unsupported — fall through to sync hide.
      }
      this.hideAnimation = null;
    }

    this.hideLayoutSync();
  }

  private hideLayoutSync(): void {
    this.usePassthroughLayout = false;
    this.visibleLayoutKind = null;

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

    releaseWalletFrameFocus(frame);

    restoreInlineStyles(frame, stored.frameClassName, stored.frameStyle);
    if (container) {
      restoreInlineStyles(
        container,
        stored.containerClassName,
        stored.containerStyle,
      );
      // Always inert + aria-hidden when collapsed — do not restore a host's
      // pre-create markup flags if that would leave a focused iframe exposed.
      concealWalletContainer(container, { ariaHidden: "true", inert: true });
    }

    this.originalLayout = null;
  }
}

/**
 * Move focus out of the branding iframe before collapsing it.
 * `document.body.focus()` is a no-op (body is not focusable by default), so
 * after WebAuthn the iframe often remains `document.activeElement` — setting
 * `aria-hidden` on its ancestor then trips Chrome's accessibility warning.
 */
export function releaseWalletFrameFocus(frame: HTMLIFrameElement): void {
  try {
    frame.blur();
  } catch {
    // ignore
  }

  if (typeof document === "undefined") {
    return;
  }

  const active = document.activeElement;
  if (active !== frame && !(active instanceof Node && frame.contains(active))) {
    return;
  }

  // Temporary focus sink: remove after focus so activeElement becomes <body>.
  const sink = document.createElement("span");
  sink.tabIndex = -1;
  sink.setAttribute("aria-hidden", "true");
  sink.style.cssText =
    "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;overflow:hidden;left:0;top:0;";
  document.body.appendChild(sink);
  try {
    sink.focus({ preventScroll: true });
  } finally {
    sink.remove();
  }
}

function concealWalletContainer(
  container: HTMLElement,
  options: { ariaHidden: string | null; inert: boolean },
): void {
  // inert first — browsers move focus out of the subtree, avoiding the
  // "aria-hidden on focused descendant" warning.
  container.inert = options.inert;
  if (options.ariaHidden !== null) {
    container.setAttribute("aria-hidden", options.ariaHidden);
  } else if (options.inert) {
    container.setAttribute("aria-hidden", "true");
  } else {
    container.removeAttribute("aria-hidden");
  }
}

function revealWalletContainer(container: HTMLElement): void {
  container.inert = false;
  container.removeAttribute("aria-hidden");
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
  container.style.setProperty("transform", "none", "important");
  container.style.removeProperty("border-radius");
  container.style.removeProperty("box-shadow");
  container.style.removeProperty("background");
  container.style.removeProperty("transition");
  concealWalletContainer(container, { ariaHidden: "true", inert: true });
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

export type CreateSignerIframeOptions = {
  hidden?: boolean;
};

export type OverlaySignerIframeOptions = {
  /**
   * Element that currently holds the iframe in the DOM (usually the branding
   * `#signer-container`). Defaults to `iframe.parentElement`.
   */
  homeContainer?: HTMLElement;
  /** Stacking order for the overlaid home container and iframe (default `"10001"`). */
  zIndex?: string;
  /** Home-container background while overlaid (default `"Canvas"`). */
  background?: string;
  /** Home-container border radius while overlaid (default `"6px"`). */
  borderRadius?: string;
};

/** Permissions Policy features for the Signing Layer iframe (set before navigation). */
const SIGNER_IFRAME_ALLOW = [
  "publickey-credentials-get *",
  "publickey-credentials-create *",
  "clipboard-write *",
].join("; ");

type StoredLayout = {
  frameStyle: Record<string, string>;
  containerStyle: Record<string, string> | null;
};

function captureInlineStyles(element: HTMLElement): Record<string, string> {
  const styles: Record<string, string> = {};
  for (let i = 0; i < element.style.length; i++) {
    const name = element.style.item(i);
    styles[name] = element.style.getPropertyValue(name);
  }
  return styles;
}

function setImportantStyle(
  element: HTMLElement,
  name: string,
  value: string,
): void {
  if (typeof element.style.setProperty === "function") {
    element.style.setProperty(name, value, "important");
    return;
  }
  (element.style as unknown as Record<string, string>)[name] = value;
}

function restoreInlineStyles(
  element: HTMLElement,
  styles: Record<string, string>,
): void {
  if (typeof element.removeAttribute === "function") {
    element.removeAttribute("style");
  }
  for (const [name, value] of Object.entries(styles)) {
    if (typeof element.style.setProperty === "function") {
      element.style.setProperty(name, value);
    } else {
      (element.style as unknown as Record<string, string>)[name] = value;
    }
  }
}

function focusIframe(iframe: HTMLIFrameElement): void {
  try {
    iframe.contentWindow?.focus();
    iframe.focus();
  } catch {
    // ignore focus failures
  }
}

/**
 * Make the nested custody signer iframe a visible centered panel for ceremonies
 * (passkey Confirm UI, passphrase, reveal key). Call synchronously immediately
 * before a signer RPC that needs signer DOM or WebAuthn.
 */
export function showSignerCeremonyPanel(
  iframe: HTMLIFrameElement,
): () => void {
  const container = iframe.parentElement;
  const stored: StoredLayout = {
    frameStyle: captureInlineStyles(iframe),
    containerStyle: container ? captureInlineStyles(container) : null,
  };

  const panelWidth = "min(22rem, 92vw)";
  /** Tall enough for default Confirm copy + buttons without an outer scrollbar. */
  const panelMinHeight = "18rem";
  const zIndex = "10001";

  if (container) {
    setImportantStyle(container, "display", "block");
    setImportantStyle(container, "position", "fixed");
    setImportantStyle(container, "top", "50%");
    setImportantStyle(container, "left", "50%");
    setImportantStyle(container, "transform", "translate(-50%, -50%)");
    setImportantStyle(container, "width", panelWidth);
    setImportantStyle(container, "height", panelMinHeight);
    setImportantStyle(container, "min-height", panelMinHeight);
    setImportantStyle(container, "max-height", "90vh");
    setImportantStyle(container, "clip-path", "none");
    setImportantStyle(container, "overflow", "hidden");
    setImportantStyle(container, "opacity", "1");
    setImportantStyle(container, "pointer-events", "auto");
    setImportantStyle(container, "z-index", zIndex);
    setImportantStyle(container, "margin", "0");
    setImportantStyle(container, "padding", "0");
    setImportantStyle(container, "background", "Canvas");
    setImportantStyle(container, "border-radius", "8px");
    setImportantStyle(container, "box-shadow", "0 8px 32px #0006");
  }

  setImportantStyle(iframe, "display", "block");
  setImportantStyle(iframe, "position", "relative");
  setImportantStyle(iframe, "top", "auto");
  setImportantStyle(iframe, "left", "auto");
  setImportantStyle(iframe, "width", "100%");
  setImportantStyle(iframe, "height", "100%");
  setImportantStyle(iframe, "min-height", panelMinHeight);
  setImportantStyle(iframe, "clip-path", "none");
  setImportantStyle(iframe, "overflow", "hidden");
  setImportantStyle(iframe, "opacity", "1");
  setImportantStyle(iframe, "pointer-events", "auto");
  setImportantStyle(iframe, "border", "0");
  setImportantStyle(iframe, "z-index", zIndex);

  focusIframe(iframe);

  return () => {
    restoreInlineStyles(iframe, stored.frameStyle);
    if (container && stored.containerStyle) {
      restoreInlineStyles(container, stored.containerStyle);
    }
  };
}

/**
 * Visually place the signer iframe over `slot` without moving it in the DOM.
 * Reparenting can reload the iframe document and drop pending signer RPCs.
 *
 * Positions the iframe's home container (fixed) to match `slot.getBoundingClientRect()`,
 * then stretches the iframe to fill that container. Call the returned function to
 * restore prior inline styles.
 */
export function overlaySignerIframe(
  iframe: HTMLIFrameElement,
  slot: HTMLElement,
  options: OverlaySignerIframeOptions = {},
): () => void {
  const homeContainer = options.homeContainer ?? iframe.parentElement;
  if (!homeContainer) {
    throw new Error(
      "overlaySignerIframe: iframe has no parentElement; pass options.homeContainer",
    );
  }

  const zIndex = options.zIndex ?? "10001";
  const background = options.background ?? "Canvas";
  const borderRadius = options.borderRadius ?? "6px";

  const savedFrameStyles = captureInlineStyles(iframe);
  const savedContainerStyles = captureInlineStyles(homeContainer);
  const rect = slot.getBoundingClientRect();

  setImportantStyle(homeContainer, "display", "block");
  setImportantStyle(homeContainer, "position", "fixed");
  setImportantStyle(homeContainer, "top", `${rect.top}px`);
  setImportantStyle(homeContainer, "left", `${rect.left}px`);
  setImportantStyle(homeContainer, "width", `${Math.max(rect.width, 1)}px`);
  setImportantStyle(homeContainer, "height", `${Math.max(rect.height, 1)}px`);
  setImportantStyle(homeContainer, "clip-path", "none");
  setImportantStyle(homeContainer, "overflow", "visible");
  setImportantStyle(homeContainer, "opacity", "1");
  setImportantStyle(homeContainer, "pointer-events", "auto");
  setImportantStyle(homeContainer, "z-index", zIndex);
  setImportantStyle(homeContainer, "margin", "0");
  setImportantStyle(homeContainer, "padding", "0");
  setImportantStyle(homeContainer, "background", background);
  setImportantStyle(homeContainer, "border-radius", borderRadius);

  setImportantStyle(iframe, "display", "block");
  setImportantStyle(iframe, "position", "absolute");
  setImportantStyle(iframe, "top", "0");
  setImportantStyle(iframe, "left", "0");
  setImportantStyle(iframe, "width", "100%");
  setImportantStyle(iframe, "height", "100%");
  setImportantStyle(iframe, "min-height", "0");
  setImportantStyle(iframe, "border", "0");
  setImportantStyle(iframe, "clip-path", "none");
  setImportantStyle(iframe, "overflow", "visible");
  setImportantStyle(iframe, "opacity", "1");
  setImportantStyle(iframe, "pointer-events", "auto");
  setImportantStyle(iframe, "z-index", zIndex);

  focusIframe(iframe);

  return () => {
    restoreInlineStyles(iframe, savedFrameStyles);
    restoreInlineStyles(homeContainer, savedContainerStyles);
  };
}

export function createSignerIframe(
  container: HTMLElement,
  signerUrl: string,
  options: CreateSignerIframeOptions = {},
): Promise<HTMLIFrameElement> {
  const hidden = options.hidden !== false;

  return new Promise((resolve, reject) => {
    const iframe = document.createElement("iframe");
    iframe.src = signerUrl;
    iframe.allow = SIGNER_IFRAME_ALLOW;
    iframe.title = "OWS custody signer";
    iframe.style.border = "0";

    if (hidden) {
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.position = "absolute";
      iframe.style.overflow = "hidden";
      iframe.style.clipPath = "inset(50%)";
    }

    iframe.addEventListener(
      "load",
      () => {
        resolve(iframe);
      },
      { once: true },
    );

    iframe.addEventListener(
      "error",
      () => {
        reject(new Error(`Failed to load custody signer iframe: ${signerUrl}`));
      },
      { once: true },
    );

    container.appendChild(iframe);
  });
}

export function getSignerOrigin(signerUrl: string): string {
  return new URL(signerUrl).origin;
}

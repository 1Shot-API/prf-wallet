export type CreateSignerIframeOptions = {
  hidden?: boolean;
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

/**
 * Make the nested custody signer iframe visible/focusable for WebAuthn.
 * Call synchronously immediately before a signer RPC that triggers passkey UI.
 */
export function prepareSignerIframeForWebAuthn(
  iframe: HTMLIFrameElement,
): () => void {
  const container = iframe.parentElement;
  const stored: StoredLayout = {
    frameStyle: captureInlineStyles(iframe),
    containerStyle: container ? captureInlineStyles(container) : null,
  };

  if (container) {
    setImportantStyle(container, "display", "block");
    setImportantStyle(container, "position", "fixed");
    setImportantStyle(container, "top", "0");
    setImportantStyle(container, "left", "0");
    setImportantStyle(container, "width", "1px");
    setImportantStyle(container, "height", "1px");
    setImportantStyle(container, "clip-path", "none");
    setImportantStyle(container, "overflow", "visible");
    setImportantStyle(container, "opacity", "0");
    setImportantStyle(container, "pointer-events", "none");
    setImportantStyle(container, "z-index", "9999");
  }

  setImportantStyle(iframe, "display", "block");
  setImportantStyle(iframe, "position", "fixed");
  setImportantStyle(iframe, "top", "0");
  setImportantStyle(iframe, "left", "0");
  setImportantStyle(iframe, "width", "1px");
  setImportantStyle(iframe, "height", "1px");
  setImportantStyle(iframe, "clip-path", "none");
  setImportantStyle(iframe, "overflow", "visible");
  setImportantStyle(iframe, "opacity", "0");
  setImportantStyle(iframe, "pointer-events", "auto");
  setImportantStyle(iframe, "border", "0");
  setImportantStyle(iframe, "z-index", "9999");

  try {
    iframe.contentWindow?.focus();
    iframe.focus();
  } catch {
    // ignore focus failures
  }

  return () => {
    restoreInlineStyles(iframe, stored.frameStyle);
    if (container && stored.containerStyle) {
      restoreInlineStyles(container, stored.containerStyle);
    }
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

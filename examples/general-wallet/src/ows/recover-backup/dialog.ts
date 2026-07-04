import type { BrandingSignerHost } from "@1shotapi/ows-branding-core";

export type RestoreBackupDialogOptions = {
  /** Element to mount the dialog into (default `document.body`). */
  container?: HTMLElement;
  /** Home container that normally holds the signer iframe (e.g. `#signer-container`). */
  signerContainer: HTMLElement;
  /** Encrypted backup blob (`ows1:…`) from app-owned storage. */
  encryptedPrivateKey: string;
};

let stylesInjected = false;

type MountedIframe = {
  iframe: HTMLIFrameElement;
  homeContainer: HTMLElement;
  savedFrameStyles: Record<string, string>;
  savedContainerStyles: Record<string, string>;
};

/**
 * Run the restore-backup flow: instructions + visible signer iframe for passphrase,
 * then `recoverKey` with the app-supplied encrypted blob.
 *
 * @returns `true` when restore completed, `false` when the user cancelled or dismissed an error.
 */
export async function runRestoreBackupFlow(
  signer: BrandingSignerHost,
  options: RestoreBackupDialogOptions,
): Promise<boolean> {
  if (!stylesInjected) {
    injectRestoreBackupStyles();
    stylesInjected = true;
  }

  const mountContainer = options.container ?? document.body;
  const iframe = options.signerContainer.querySelector("iframe");
  if (!(iframe instanceof HTMLIFrameElement)) {
    throw new Error("Signer iframe not found in signerContainer");
  }

  let aborted = false;
  let mounted: MountedIframe | null = null;
  let settled = false;

  const overlay = document.createElement("div");
  overlay.className = "ows-restore-overlay";
  overlay.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "ows-restore-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "ows-restore-title");

  const title = document.createElement("h2");
  title.id = "ows-restore-title";
  title.className = "ows-restore-title";
  title.textContent = "Restore backup";

  const body = document.createElement("p");
  body.className = "ows-restore-body";
  body.textContent =
    "Enter the passphrase you used when creating this backup to unlock your wallet.";

  const signerSlot = document.createElement("div");
  signerSlot.id = "ows-restore-signer-slot";
  signerSlot.className = "ows-restore-signer-slot";

  const errorEl = document.createElement("p");
  errorEl.className = "ows-restore-error";
  errorEl.hidden = true;

  const actions = document.createElement("div");
  actions.className = "ows-restore-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ows-restore-button ows-restore-button--secondary";
  cancelButton.textContent = "Cancel";

  actions.append(cancelButton);
  dialog.append(title, body, signerSlot, errorEl, actions);
  overlay.append(dialog);
  mountContainer.append(overlay);

  const teardown = (): void => {
    if (mounted) {
      restoreSignerIframe(mounted);
      mounted = null;
    }
    overlay.remove();
  };

  const finish = (resolve: (restored: boolean) => void, restored: boolean): void => {
    if (settled) return;
    settled = true;
    aborted = true;
    teardown();
    resolve(restored);
  };

  return new Promise<boolean>((resolve, reject) => {
    cancelButton.addEventListener("click", () => finish(resolve, false));

    void (async () => {
      try {
        mounted = mountSignerIframe(
          iframe,
          signerSlot,
          options.signerContainer,
        );
        await waitForPaint();

        await signer.recoverKey(
          options.encryptedPrivateKey,
          "Backup passphrase",
          "Restore",
        );

        if (aborted || settled) return;

        restoreSignerIframe(mounted);
        mounted = null;
        signerSlot.hidden = true;
        body.textContent =
          "Wallet restored. You can sign until this tab is closed.";
        cancelButton.remove();

        const doneButton = document.createElement("button");
        doneButton.type = "button";
        doneButton.className = "ows-restore-button ows-restore-button--primary";
        doneButton.textContent = "Done";
        doneButton.addEventListener("click", () => finish(resolve, true));
        actions.replaceChildren(doneButton);
        doneButton.focus();
      } catch (error) {
        if (aborted || settled) return;

        if (mounted) {
          restoreSignerIframe(mounted);
          mounted = null;
        }
        signerSlot.hidden = true;

        errorEl.hidden = false;
        errorEl.textContent = formatRestoreError(error);
        cancelButton.textContent = "Close";
        cancelButton.focus();
      }
    })().catch((error: unknown) => {
      if (aborted || settled) return;
      teardown();
      settled = true;
      reject(error);
    });
  });
}

/**
 * Visually place the signer iframe over `slot` without moving it in the DOM.
 * Reparenting can reload the iframe document and drop pending signer RPCs.
 */
function mountSignerIframe(
  iframe: HTMLIFrameElement,
  slot: HTMLElement,
  homeContainer: HTMLElement,
): MountedIframe {
  const savedFrameStyles = captureInlineStyles(iframe);
  const savedContainerStyles = captureInlineStyles(homeContainer);
  const rect = slot.getBoundingClientRect();
  const zIndex = "10001";

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
  setImportantStyle(homeContainer, "background", "Canvas");
  setImportantStyle(homeContainer, "border-radius", "6px");

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

  try {
    iframe.contentWindow?.focus();
    iframe.focus();
  } catch {
    // ignore focus failures
  }

  return { iframe, homeContainer, savedFrameStyles, savedContainerStyles };
}

function restoreSignerIframe(mounted: MountedIframe): void {
  const { iframe, homeContainer, savedFrameStyles, savedContainerStyles } =
    mounted;
  restoreInlineStyles(iframe, savedFrameStyles);
  restoreInlineStyles(homeContainer, savedContainerStyles);
}

function setImportantStyle(
  element: HTMLElement,
  name: string,
  value: string,
): void {
  element.style.setProperty(name, value, "important");
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

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
  styles: Record<string, string>,
): void {
  element.removeAttribute("style");
  for (const [name, value] of Object.entries(styles)) {
    element.style.setProperty(name, value);
  }
}

function formatRestoreError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (
      message.includes("decryptionFailed") ||
      message.includes("decrypt") ||
      message.includes("OperationError")
    ) {
      return "Could not decrypt the backup. Check the passphrase and try again.";
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return "Passkey prompt was cancelled or blocked.";
    }
    return message || "Restore failed.";
  }
  return "Restore failed.";
}

/** @internal */
export function injectRestoreBackupStyles(): void {
  if (document.getElementById("ows-restore-dialog-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ows-restore-dialog-styles";
  style.textContent = `
    .ows-restore-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: color-mix(in srgb, CanvasText 35%, transparent);
    }
    .ows-restore-dialog {
      width: min(30rem, 100%);
      max-height: min(85vh, 36rem);
      overflow: auto;
      padding: 1.25rem;
      border-radius: 10px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 12px 40px color-mix(in srgb, CanvasText 25%, transparent);
      font-family: system-ui, sans-serif;
      line-height: 1.5;
    }
    .ows-restore-title {
      margin: 0 0 0.75rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .ows-restore-body {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .ows-restore-signer-slot {
      margin: 0 0 1rem;
      min-height: 7rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 6px;
      overflow: hidden;
      background: color-mix(in srgb, CanvasText 4%, Canvas);
    }
    .ows-restore-error {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      color: color-mix(in srgb, CanvasText 20%, #c00);
    }
    .ows-restore-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .ows-restore-button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ows-restore-button--primary {
      background: color-mix(in srgb, CanvasText 12%, Canvas);
      font-weight: 500;
    }
    .ows-restore-button:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;
  document.head.append(style);
}

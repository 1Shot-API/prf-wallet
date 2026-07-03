import type {
  BrandingSignerHost,
  CreateBackupResult,
} from "@1shotapi/ows-branding-core";

export type CreateBackupDialogOptions = {
  /** Element to mount the dialog into (default `document.body`). */
  container?: HTMLElement;
  /** Home container that normally holds the signer iframe (e.g. `#signer-container`). */
  signerContainer: HTMLElement;
  /** Minimum passphrase length shown in copy and passed to the signer. */
  minPasswordLength?: number;
  /** Override result presentation (default: in-dialog copy UI). */
  showResult?: (result: CreateBackupResult) => Promise<void>;
};

const DEFAULT_MIN_PASSWORD_LENGTH = 12;

let stylesInjected = false;

type MountedIframe = {
  iframe: HTMLIFrameElement;
  homeContainer: HTMLElement;
  savedFrameStyles: Record<string, string>;
  savedContainerStyles: Record<string, string>;
};

/**
 * Run the create-backup flow: instructions + visible signer iframe for passphrase,
 * then show the encrypted recovery blob with copy.
 *
 * Resolves when the user finishes (Done) or cancels. Rejects only on unexpected errors
 * after the user has not cancelled.
 */
export async function runCreateBackupFlow(
  signer: BrandingSignerHost,
  options: CreateBackupDialogOptions,
): Promise<void> {
  if (!stylesInjected) {
    injectCreateBackupStyles();
    stylesInjected = true;
  }

  const minPasswordLength =
    options.minPasswordLength ?? DEFAULT_MIN_PASSWORD_LENGTH;
  const mountContainer = options.container ?? document.body;
  const iframe = options.signerContainer.querySelector("iframe");
  if (!(iframe instanceof HTMLIFrameElement)) {
    throw new Error("Signer iframe not found in signerContainer");
  }

  let aborted = false;
  let mounted: MountedIframe | null = null;
  let settled = false;

  const overlay = document.createElement("div");
  overlay.className = "ows-backup-overlay";
  overlay.setAttribute("role", "presentation");

  const dialog = document.createElement("div");
  dialog.className = "ows-backup-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "ows-backup-title");

  const title = document.createElement("h2");
  title.id = "ows-backup-title";
  title.className = "ows-backup-title";
  title.textContent = "Create backup";

  const body = document.createElement("p");
  body.className = "ows-backup-body";
  body.textContent = `Enter a passphrase of at least ${minPasswordLength} characters to encrypt your private key. Store the backup somewhere safe — you will need it to restore your wallet.`;

  const signerSlot = document.createElement("div");
  signerSlot.id = "ows-backup-signer-slot";
  signerSlot.className = "ows-backup-signer-slot";

  const errorEl = document.createElement("p");
  errorEl.className = "ows-backup-error";
  errorEl.hidden = true;

  const actions = document.createElement("div");
  actions.className = "ows-backup-actions";

  const cancelButton = document.createElement("button");
  cancelButton.type = "button";
  cancelButton.className = "ows-backup-button ows-backup-button--secondary";
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

  const finish = (resolve: () => void): void => {
    if (settled) return;
    settled = true;
    aborted = true;
    teardown();
    resolve();
  };

  return new Promise<void>((resolve, reject) => {
    cancelButton.addEventListener("click", () => finish(resolve));

    void (async () => {
      try {
        // Position over the slot without reparenting — moving an iframe in the
        // DOM can reload its document and drop in-flight postMessage RPCs.
        mounted = mountSignerIframe(
          iframe,
          signerSlot,
          options.signerContainer,
        );
        await waitForPaint();

        const result = await signer.createRecoveryData(
          `Passphrase (min ${minPasswordLength} characters)`,
          "Continue",
          minPasswordLength,
        );

        if (aborted || settled) return;

        restoreSignerIframe(mounted);
        mounted = null;
        signerSlot.hidden = true;
        body.hidden = true;
        cancelButton.remove();

        if (options.showResult) {
          overlay.remove();
          await options.showResult(result);
          if (!settled) {
            settled = true;
            resolve();
          }
        } else {
          await showDefaultBackupResult(result, dialog, actions, () =>
            finish(resolve),
          );
        }
      } catch (error) {
        if (aborted || settled) return;

        if (mounted) {
          restoreSignerIframe(mounted);
          mounted = null;
        }
        signerSlot.hidden = true;

        errorEl.hidden = false;
        errorEl.textContent = formatBackupError(error);
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

function showDefaultBackupResult(
  result: CreateBackupResult,
  dialog: HTMLElement,
  actions: HTMLElement,
  onDone: () => void,
): Promise<void> {
  return new Promise((resolve) => {
    const label = document.createElement("p");
    label.className = "ows-backup-label";
    label.textContent = "Encrypted backup";

    const pre = document.createElement("pre");
    pre.className = "ows-backup-blob";
    pre.textContent = result.encryptedPrivateKey;

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "ows-backup-button ows-backup-button--secondary";
    copyButton.textContent = "Copy";

    const doneButton = document.createElement("button");
    doneButton.type = "button";
    doneButton.className = "ows-backup-button ows-backup-button--primary";
    doneButton.textContent = "Done";

    copyButton.addEventListener("click", () => {
      void navigator.clipboard.writeText(result.encryptedPrivateKey).then(
        () => {
          copyButton.textContent = "Copied";
          setTimeout(() => {
            copyButton.textContent = "Copy";
          }, 1500);
        },
        () => {
          copyButton.textContent = "Copy failed";
        },
      );
    });

    doneButton.addEventListener("click", () => {
      onDone();
      resolve();
    });

    actions.replaceChildren(copyButton, doneButton);
    dialog.insertBefore(label, actions);
    dialog.insertBefore(pre, actions);
    doneButton.focus();
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
  // Above `.ows-backup-overlay` (z-index 10000) so the passphrase UI is interactive.
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

function formatBackupError(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    if (message.includes("passwordTooShort")) {
      return "Passphrase is too short. Try again.";
    }
    if (message.includes("NotAllowed") || message.includes("not allowed")) {
      return "Passkey prompt was cancelled or blocked.";
    }
    return message || "Backup failed.";
  }
  return "Backup failed.";
}

/** @internal */
export function injectCreateBackupStyles(): void {
  if (document.getElementById("ows-backup-dialog-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ows-backup-dialog-styles";
  style.textContent = `
    .ows-backup-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: color-mix(in srgb, CanvasText 35%, transparent);
    }
    .ows-backup-dialog {
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
    .ows-backup-title {
      margin: 0 0 0.75rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .ows-backup-body {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      opacity: 0.9;
    }
    .ows-backup-label {
      margin: 0 0 0.25rem;
      font-size: 0.8rem;
      font-weight: 500;
      opacity: 0.75;
    }
    .ows-backup-signer-slot {
      margin: 0 0 1rem;
      min-height: 7rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 6px;
      overflow: hidden;
      background: color-mix(in srgb, CanvasText 4%, Canvas);
    }
    .ows-backup-blob {
      margin: 0 0 1rem;
      padding: 0.75rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 10rem;
      overflow: auto;
    }
    .ows-backup-error {
      margin: 0 0 1rem;
      font-size: 0.9rem;
      color: color-mix(in srgb, CanvasText 20%, #c00);
    }
    .ows-backup-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .ows-backup-button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ows-backup-button--primary {
      background: color-mix(in srgb, CanvasText 12%, Canvas);
      font-weight: 500;
    }
    .ows-backup-button:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;
  document.head.append(style);
}

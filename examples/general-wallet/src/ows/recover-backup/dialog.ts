import type { BrandingSignerHost } from "@1shotapi/ows-branding-core";
import { overlaySignerIframe } from "@1shotapi/ows-signer-utils";

export type RestoreBackupDialogOptions = {
  /** Element to mount the dialog into (default `document.body`). */
  container?: HTMLElement;
  /** Home container that normally holds the signer iframe (e.g. `#signer-container`). */
  signerContainer: HTMLElement;
  /** Encrypted backup blob (`ows1:…`) from app-owned storage. */
  encryptedPrivateKey: string;
};

let stylesInjected = false;

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
  let restoreOverlay: (() => void) | null = null;
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
    if (restoreOverlay) {
      restoreOverlay();
      restoreOverlay = null;
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
        restoreOverlay = overlaySignerIframe(iframe, signerSlot, {
          homeContainer: options.signerContainer,
        });
        await waitForPaint();

        await signer.recoverKey(
          options.encryptedPrivateKey,
          "Backup passphrase",
          "Restore",
        );

        if (aborted || settled) return;

        restoreOverlay();
        restoreOverlay = null;
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

        if (restoreOverlay) {
          restoreOverlay();
          restoreOverlay = null;
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

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
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

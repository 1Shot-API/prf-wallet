import type { PersonalSignApprovalRequest } from "@1shotapi/ows-branding-core";

export type ApprovalDialogOptions = {
  /** Element to mount the dialog into (default `document.body`). */
  container?: HTMLElement;
};

let stylesInjected = false;

/**
 * Prompt the user to approve an EIP-191 personal_sign request.
 * Resolves `true` on Sign, `false` on Reject or dismiss.
 */
export function requestPersonalSignApproval(
  request: PersonalSignApprovalRequest,
  options?: ApprovalDialogOptions,
): Promise<boolean> {
  if (!stylesInjected) {
    injectApprovalDialogStyles();
    stylesInjected = true;
  }

  const container = options?.container ?? document.body;

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "ows-approval-overlay";
    overlay.setAttribute("role", "presentation");

    const dialog = document.createElement("div");
    dialog.className = "ows-approval-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-labelledby", "ows-approval-title");

    const title = document.createElement("h2");
    title.id = "ows-approval-title";
    title.className = "ows-approval-title";
    title.textContent = "Sign message";

    const addressLabel = document.createElement("p");
    addressLabel.className = "ows-approval-label";
    addressLabel.textContent = "Account";

    const addressValue = document.createElement("p");
    addressValue.className = "ows-approval-address";
    addressValue.textContent = request.address;

    const messageLabel = document.createElement("p");
    messageLabel.className = "ows-approval-label";
    messageLabel.textContent = "Message";

    const messageValue = document.createElement("pre");
    messageValue.className = "ows-approval-message";
    messageValue.textContent = formatMessageForDisplay(request.message);

    const actions = document.createElement("div");
    actions.className = "ows-approval-actions";

    const rejectButton = document.createElement("button");
    rejectButton.type = "button";
    rejectButton.className = "ows-approval-button ows-approval-button--secondary";
    rejectButton.textContent = "Reject";

    const signButton = document.createElement("button");
    signButton.type = "button";
    signButton.className = "ows-approval-button ows-approval-button--primary";
    signButton.textContent = "Sign";

    let settled = false;

    const finish = (approved: boolean): void => {
      if (settled) return;
      settled = true;
      overlay.remove();
      resolve(approved);
    };

    rejectButton.addEventListener("click", () => finish(false));
    signButton.addEventListener("click", () => finish(true));
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        finish(false);
      }
    });

    actions.append(rejectButton, signButton);
    dialog.append(
      title,
      addressLabel,
      addressValue,
      messageLabel,
      messageValue,
      actions,
    );
    overlay.append(dialog);
    container.append(overlay);

    signButton.focus();
  });
}

function formatMessageForDisplay(message: string): string {
  if (message.startsWith("0x") && message.length > 2) {
    try {
      const bytes = hexToBytes(message.slice(2));
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      if (isMostlyPrintable(decoded)) {
        return decoded;
      }
    } catch {
      // fall through to raw message
    }
  }
  return message;
}

function hexToBytes(hex: string): Uint8Array {
  const normalized = hex.length % 2 === 0 ? hex : `0${hex}`;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(normalized.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function isMostlyPrintable(text: string): boolean {
  if (!text.trim()) return false;
  let printable = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    if (code >= 32 && code !== 127) printable++;
  }
  return printable / text.length >= 0.85;
}

/** @internal */
export function injectApprovalDialogStyles(): void {
  if (document.getElementById("ows-approval-dialog-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "ows-approval-dialog-styles";
  style.textContent = `
    .ows-approval-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
      background: color-mix(in srgb, CanvasText 35%, transparent);
    }
    .ows-approval-dialog {
      width: min(28rem, 100%);
      max-height: min(80vh, 32rem);
      overflow: auto;
      padding: 1.25rem;
      border-radius: 10px;
      background: Canvas;
      color: CanvasText;
      box-shadow: 0 12px 40px color-mix(in srgb, CanvasText 25%, transparent);
      font-family: system-ui, sans-serif;
      line-height: 1.5;
    }
    .ows-approval-title {
      margin: 0 0 1rem;
      font-size: 1.125rem;
      font-weight: 600;
    }
    .ows-approval-label {
      margin: 0 0 0.25rem;
      font-size: 0.8rem;
      font-weight: 500;
      opacity: 0.75;
    }
    .ows-approval-address {
      margin: 0 0 0.75rem;
      font-family: ui-monospace, monospace;
      font-size: 0.8rem;
      word-break: break-all;
    }
    .ows-approval-message {
      margin: 0 0 1rem;
      padding: 0.75rem;
      border: 1px solid color-mix(in srgb, CanvasText 20%, transparent);
      border-radius: 6px;
      font-family: ui-monospace, monospace;
      font-size: 0.85rem;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .ows-approval-actions {
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }
    .ows-approval-button {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid color-mix(in srgb, CanvasText 25%, transparent);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .ows-approval-button--primary {
      background: color-mix(in srgb, CanvasText 12%, Canvas);
      font-weight: 500;
    }
    .ows-approval-button:focus-visible {
      outline: 2px solid Highlight;
      outline-offset: 2px;
    }
  `;
  document.head.append(style);
}
